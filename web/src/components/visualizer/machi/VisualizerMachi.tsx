import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import type { Line, Theme } from '../../../types';
import { DEFAULT_LYRIC_RENDER_QUALITY } from '../../../utils/lyricRenderQuality';
import { loadLucideIcons } from '../../../utils/lucideIconResolver';
import { resolveThemeFontStack, resolveThemeFontWeight } from '../../../utils/fontStacks';
import { getLineRenderEndTime } from '../../../utils/lyrics/renderHints';
import type { VisualizerSharedProps } from '../definition';
import { useVisualizerPixiHost } from '../pixiRuntimeHost';
import { useVisualizerRuntime } from '../runtime';
import { useVisualizerSongCommit } from '../songHandover';
import { resolveSubtitleFontSizes } from '../subtitleFontSizes';
import VisualizerShell from '../VisualizerShell';
import VisualizerSubtitleOverlay from '../VisualizerSubtitleOverlay';
import { closeMachiCameraBar, isMachiCameraBarOpen, subscribeMachiCameraBar, toggleMachiCameraBar } from './cameraBar';
import type { MachiRuntime, MachiSongContext } from './createMachiRuntime';
import MachiCameraBar from './MachiCameraBar';
import { DEFAULT_MACHI_TUNING, type MachiSceneId, type MachiTuning } from './types';

// src/components/visualizer/machi/VisualizerMachi.tsx
// 町景的 React 外壳：挂共享 shell 与底部字幕层，把按需加载的 three.js 运行时建一次（useVisualizerPixiHost 托管，
// 它与渲染器无关），换歌、换主题、换设置（场景、时间、天气）、暂停、静态模式都就地推给运行时。
// WebGL 上下文丢了就换一个 epoch 重建；透明模式（播放页透明）切换时也重建（画布带不带 alpha 只能在建上下文时定）。
// 每帧的时间只在运行时的循环里读 currentTime，不进 React state。
// 播放页上（不是预览、宿主存得下改动）控制面板的摄影机按钮打开取景控制条（MachiCameraBar）：开着时底部字幕让开；
// 拖它的滑块时改动先记在这里的草稿上、只推给运行时，松手或收起时再一次存下。

const EMPTY_LINES: Line[] = [];

/** 主题没有图标时招牌上用的兜底图标。 */
export const MACHI_FALLBACK_ICONS = ['Store', 'Umbrella', 'CloudRain', 'Moon'];

/** 招牌同步画图标：建运行时与换歌 / 换主题前先把主题图标和兜底图标加载好。 */
const loadMachiIcons = (theme: Theme) => loadLucideIcons([...(theme.lyricsIcons ?? []), ...MACHI_FALLBACK_ICONS]);

interface VisualizerMachiProps extends VisualizerSharedProps {
    machiTuning?: MachiTuning;
}

const VisualizerMachi: React.FC<VisualizerMachiProps> = (props) => {
    const {
        machiTuning = DEFAULT_MACHI_TUNING,
        currentTime,
        currentLineIndex,
        lines,
        theme,
        audioPower,
        audioBands,
        showText = true,
        lyricsFontScale = 1,
        staticMode = false,
        paused = false,
        isPreviewMode = false,
        seed = 'machi',
        songTitle,
        songArtist,
        songAlbum,
        isPlayerChromeHidden = false,
        hideTranslationSubtitle = false,
        showSubtitleTranslation = true,
        subtitleContentMode,
        subtitleTheme,
        subtitleFontScale,
        subtitleOverlayOpacity,
        subtitleOverlayBackground,
        onMachiTuningChange,
    } = props;
    // 透明模式：町景不画天空，透出后面的背景。
    const transparent = !isPreviewMode && (props.background?.transparent ?? false);
    const { t } = useTranslation();
    const hostRef = useRef<HTMLDivElement>(null);
    const [runtimeFailed, setRuntimeFailed] = useState(false);
    const renderQuality = DEFAULT_LYRIC_RENDER_QUALITY;
    const [contextEpoch, setContextEpoch] = useState(0);
    const cameraBarAvailable = !isPreviewMode && Boolean(onMachiTuningChange);
    const cameraBarOpen = useSyncExternalStore(subscribeMachiCameraBar, isMachiCameraBarOpen, isMachiCameraBarOpen) && cameraBarAvailable;
    const [shownScene, setShownScene] = useState<MachiSceneId | null>(null);
    const barDraftRef = useRef<Partial<MachiTuning> | null>(null);
    const [barDraft, setBarDraft] = useState<Partial<MachiTuning> | null>(null);
    const shownTuning = useMemo(
        () => (barDraft ? { ...machiTuning, ...barDraft, views: { ...machiTuning.views, ...barDraft.views } } : machiTuning),
        [machiTuning, barDraft],
    );
    const dragRef = useRef({ x: 0, y: 0, moved: false });

    const latestRef = useRef({ theme, paused, showText, staticMode, machiTuning, shownTuning, renderQuality, onMachiTuningChange });
    latestRef.current = { theme, paused, showText, staticMode, machiTuning, shownTuning, renderQuality, onMachiTuningChange };

    const previewFromBar = useCallback((patch: Partial<MachiTuning>) => {
        barDraftRef.current = { ...barDraftRef.current, ...patch };
        setBarDraft(barDraftRef.current);
    }, []);
    // 把草稿（连同这一下的改动）存下；没有要存的就什么也不做。
    const commitFromBar = useCallback((patch?: Partial<MachiTuning>) => {
        const draft = { ...barDraftRef.current, ...patch };
        barDraftRef.current = null;
        setBarDraft(null);
        if (Object.keys(draft).length > 0) latestRef.current.onMachiTuningChange?.(draft);
    }, []);
    const flushBar = useCallback(() => commitFromBar(), [commitFromBar]);

    // 真正在画的歌：切歌时滞后于 props，免得对着还没到的歌词换牌面（songHandover.ts）。
    const committedSong = useVisualizerSongCommit({ seed, lines, currentTime, readyGraceMs: 3000 });
    const committedLines = committedSong.isInstrumental ? EMPTY_LINES : committedSong.lines;

    const { activeLine, recentCompletedLine, nextLines } = useVisualizerRuntime({
        currentTime,
        currentLineIndex,
        lines,
        getLineEndTime: getLineRenderEndTime,
    });

    const songContext = useMemo<MachiSongContext>(() => ({
        seed: committedSong.seed ?? 'machi',
        lines: committedLines,
        isInstrumental: committedSong.isInstrumental,
        title: songTitle ?? '',
        artist: songArtist ?? '',
        album: songAlbum ?? '',
    }), [committedLines, committedSong.isInstrumental, committedSong.seed, songAlbum, songArtist, songTitle]);

    const runtimeRef = useVisualizerPixiHost<MachiRuntime, MachiSongContext>({
        hostRef,
        label: 'Machi',
        // 只有真正需要新 WebGL 上下文的输入；歌、主题、暂停、静态模式都就地推给运行时。
        rebuildKey: [currentTime, audioPower, audioBands, isPreviewMode, transparent, contextEpoch],
        song: songContext,
        create: async (host, song, signal) => {
            const [{ MachiRuntime: Runtime }] = await Promise.all([
                import('./createMachiRuntime'),
                loadMachiIcons(latestRef.current.theme),
            ]);
            const latest = latestRef.current;
            const runtime = await Runtime.create({
                host,
                song,
                theme: latest.theme,
                tuning: latest.shownTuning,
                renderQuality: latest.renderQuality,
                currentTime,
                audioPower,
                audioBands,
                paused: latest.paused,
                staticMode: latest.staticMode,
                showText: latest.showText,
                previewMode: isPreviewMode,
                transparent,
                // 自定义视角下拖动停稳了：新视角存进 tuning 里这个场景的那一份（宿主经 onVisualizerTuningChange 存）。
                onViewChange: (view, scene) => {
                    const latest = latestRef.current;
                    latest.onMachiTuningChange?.({ camera: 'custom', views: { ...latest.machiTuning.views, [scene]: view } } satisfies Partial<MachiTuning>);
                },
                onSceneShown: setShownScene,
                fallbackIcons: MACHI_FALLBACK_ICONS,
                onContextLost: () => setContextEpoch(epoch => epoch + 1),
                signal,
            });
            const current = latestRef.current;
            runtime.setTheme(current.theme);
            runtime.setTuning(current.shownTuning);
            runtime.setRenderQuality(current.renderQuality);
            runtime.setShowText(current.showText);
            runtime.setStaticMode(current.staticMode);
            runtime.setPaused(current.paused);
            return runtime;
        },
        swap: async (runtime, song) => {
            await loadMachiIcons(latestRef.current.theme);
            runtime.swapSong(song);
        },
        destroy: runtime => runtime.destroy(),
        onFailedChange: setRuntimeFailed,
    });

    useEffect(() => {
        let cancelled = false;
        void loadMachiIcons(theme).then(() => {
            if (!cancelled) runtimeRef.current?.setTheme(theme);
        });
        return () => { cancelled = true; };
    }, [theme, runtimeRef]);

    useEffect(() => {
        runtimeRef.current?.setTuning(shownTuning);
    }, [shownTuning, runtimeRef]);

    useEffect(() => {
        runtimeRef.current?.setRenderQuality(renderQuality);
    }, [renderQuality, runtimeRef]);

    useEffect(() => {
        runtimeRef.current?.setShowText(showText);
    }, [showText, runtimeRef]);

    useEffect(() => {
        runtimeRef.current?.setStaticMode(staticMode);
    }, [staticMode, runtimeRef]);

    useEffect(() => {
        runtimeRef.current?.setPaused(paused);
    }, [paused, runtimeRef]);

    // 离开播放页、播放页的町景画面拆掉（换了别的歌词样式）时收起取景控制条。
    useEffect(() => {
        if (!cameraBarAvailable) return undefined;
        return () => closeMachiCameraBar();
    }, [cameraBarAvailable]);

    // 取景控制条收起（不论从哪收起）时，还没存的拖动改动存下。
    useEffect(() => {
        if (!cameraBarOpen) commitFromBar();
    }, [cameraBarOpen, commitFromBar]);

    // 暂停时循环停着，拖动进度要手动补一帧。
    useEffect(() => currentTime.on('change', () => {
        if (paused || staticMode) runtimeRef.current?.renderOnce();
    }), [currentTime, paused, staticMode, runtimeRef]);

    const fallbackFontFamily = resolveThemeFontStack(theme);
    const fallbackFontWeight = resolveThemeFontWeight(theme, 700);
    const subtitleFontSizes = resolveSubtitleFontSizes(lyricsFontScale);

    return (
        <VisualizerShell
            theme={theme}
            audioPower={audioPower}
            audioBands={audioBands}
            sharedProps={props}
            renderBackground={false}
            clearBackdrop={transparent}
        >
            <div className="absolute inset-0 z-10 overflow-hidden">
                <div
                    ref={hostRef}
                    className={`absolute inset-0 z-10 ${isPreviewMode ? 'pointer-events-none' : ''}`}
                    aria-hidden="true"
                    onPointerDown={event => {
                        dragRef.current = { x: event.clientX, y: event.clientY, moved: false };
                    }}
                    onPointerMove={event => {
                        if (Math.hypot(event.clientX - dragRef.current.x, event.clientY - dragRef.current.y) > 6) {
                            dragRef.current.moved = true;
                        }
                    }}
                    onClick={event => {
                        if (dragRef.current.moved) event.stopPropagation();
                    }}
                />
                {runtimeFailed && (
                    <div
                        className="pointer-events-none absolute inset-0 flex items-center justify-center px-10 text-center"
                        style={{
                            color: theme.primaryColor,
                            fontFamily: fallbackFontFamily,
                            fontWeight: fallbackFontWeight,
                            fontSize: `clamp(2rem, ${5.4 * lyricsFontScale}vw, 5.6rem)`,
                        }}
                    >
                        {showText && !committedSong.isInstrumental ? (activeLine?.fullText || t('ui.waitingForMusic')) : null}
                    </div>
                )}
            </div>

            {cameraBarAvailable && (
                <button
                    type="button"
                    className="absolute right-4 top-4 z-30 rounded-full border border-white/20 p-2 backdrop-blur-md"
                    style={{ backgroundColor: 'rgba(8,10,16,0.55)', color: theme.primaryColor }}
                    aria-label={t('options.machiCameraBar')}
                    onClick={event => {
                        event.stopPropagation();
                        toggleMachiCameraBar();
                    }}
                >
                    <Camera size={16} />
                </button>
            )}

            {cameraBarOpen && shownScene && onMachiTuningChange && (
                <MachiCameraBar
                    tuning={shownTuning}
                    scene={shownScene}
                    theme={theme}
                    t={t}
                    onPreview={previewFromBar}
                    onCommit={flushBar}
                    onTuningChange={commitFromBar}
                    onClose={closeMachiCameraBar}
                />
            )}

            <VisualizerSubtitleOverlay
                showText={showText && !cameraBarOpen}
                activeLine={activeLine}
                recentCompletedLine={recentCompletedLine}
                nextLines={nextLines}
                theme={theme}
                subtitleTheme={subtitleTheme}
                translationFontSize={subtitleFontSizes.translationFontSize}
                upcomingFontSize={subtitleFontSizes.upcomingFontSize}
                subtitleFontScale={subtitleFontScale}
                subtitleOverlayOpacity={subtitleOverlayOpacity}
                subtitleOverlayBackground={subtitleOverlayBackground}
                isPlayerChromeHidden={isPlayerChromeHidden}
                hideTranslationSubtitle={hideTranslationSubtitle}
                showSubtitleTranslation={showSubtitleTranslation}
                subtitleContentMode={subtitleContentMode}
            />
        </VisualizerShell>
    );
};

export default VisualizerMachi;
