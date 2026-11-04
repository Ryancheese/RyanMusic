# JMGO music visualization demos

The demo now includes the first six selected scenes:

- `jmgo.html?scene=flowing`: 01 FlowingIllusion
- `jmgo.html?scene=mobius`: 02 Mobius
- `jmgo.html?scene=shapes`: 03 ShapesFX
- `jmgo.html?scene=elantra`: 04 ElantraBall
- `jmgo.html?scene=matrix`: 05 Matrix
- `jmgo.html?scene=vinyl`: 06 VinylLRC

ShapesFX preserves two original meshes with UV0–UV4, five source materials and
five textures. Select a fixed variant in 效果设置 → 造型. The resource bundle has
no text layout or camera setting. Its source metadata remains unchanged; the demo
adds a separate readable player-caption layer and defaults to the cube preset.
ElantraBall uses the same high-contrast lower caption presentation instead of
placing small regular-font text over the bright sphere. Both overlays remain
visible in immersive mode and honor the lyric toggle. These player presentation
choices are separate from recovered scene data. The Shapes camera is explicitly
inferred demo framing. Audio-to-deformation and
rotation control remain documented adapters; the original shader bodies are
unchanged. Enhanced mode fixes the Shapes camera at its preset's maximum deformation
envelope so framing cannot cancel its visible expansion. Raw mode retains the prior
adaptive framing. Neither is a recovered native camera.

## Rhythm and typography controls

效果设置 offers rhythm enhancement and strength for 02/03/04, five lyric effects
(clean, focus, neon, poster, karaoke), four fonts and a 65–135% size range.
The demo defaults to focus entry with the original YouShe poster font. `rhythm.js`
adapts input peaks with a noise floor, fast attack/release envelopes and transient
detection. Mobius adds beat breathing and moving highlights; Shapes emphasizes
face expansion; Elantra boosts eight-band deformation and triggers short particle
bursts on measured attacks. Disabling enhancement restores the previous drive.
These controls are requested player enhancements, not recovered native behavior.

`lyric-effects.js` animates glyph paint/transforms from playback time, keeping line
metrics stable on pause and seek. Karaoke highlighting estimates progress within
each LRC line; it has no word timing unless a future host supplies it. Source fonts
are recorded in `fonts/lyric-fonts-provenance.json`; the 22.9 MB serif face loads
only when selected. Chinese fallback fonts remain enabled for missing glyphs.

Vinyl lyrics now use one DOM block per lyric, actual wrapped active/inactive
measurements, cumulative heights and a single deterministic scroll offset.
Font completion, width, size and effect changes invalidate the measurement cache.
Newlines and mixed Chinese/Latin text reserve their full height. This replaces
fixed-height recycled slots that overlapped on wrapped lines.

Run `node --test tests/jmgo*.test.mjs` from the repository root. The browser fixture
`jmgo/qa/lyrics.html` checks 1,800 DOM spacing/pause assertions across four fonts,
five effects, three widths, two sizes and forward/backward seeks.

VinylLRC defaults to the source-enabled Cover2D03 layout. It retains source tight
sprite outlines, nine-slice borders, an original cover mesh, unlit material and
the original orthographic camera. Original streamed cubic Start/Stop clips animate
the arm, including while the playback clock is paused. Disc angle follows playback
time, so seeks are reproducible. The module returns its own projected metadata and
lyric `overlay`; `mountJmgoScene` appends it and removes it on cleanup. Native
Animator blending, runtime lyric pooling and layout overrides remain unverified.

`assets.js` bounds resource fetch/image loads to three concurrent requests across
all six renderers. Connection failures retry once; image loads have a deadline so
a lost connection cannot leave the loading state stuck indefinitely. No source
geometry, material or shader math is changed by this loader.

The scene switcher retains the same audio element, loaded LRC and playback time.
Every scene loads from its own exported resources. `mountJmgoScene` shares the
canvas lifecycle and DOM lyric overlay. Source layout data and fonts are retained;
the selected player font/effect and explicit scene presentation can override the
recovered presentation. DOM glyph layout approximates TextMeshPro/SDF rendering.

The new native WebGL2 renderers use the bundled Three.js 0.185.1 modules for matrix
math only. Geometry is not regenerated with Three primitives. Mobius includes the
original Unity built-in Quad from the supplied APK for its light overlays.
Matrix preserves its original UV1, vertex colors and 16 material programs.
Elantra preserves the original 600-vertex faceted mesh, five textures and eight-band
vertex displacement. Its circle-particle cadence remains a recorded approximation.

The host provides eight frequency ranges (35–80, 80–160, 160–320, 320–640,
640–1280, 1280–2560, 2560–5120, 5120–12000 Hz), clipped to the analyser range.
These normalized byte-spectrum RMS values are a demo adapter, not a recovered
native normalizer. Mobius motion and UV input, MatrixAudio segment activation and
Elantra particle triggering have explicit inference notes in their provenance files.

Each new scene has its own `provenance.json`, original shader exports, exported
scene data and repeatable exporter under `scripts/export-jmgo-{name}.py`.
The renderers all implement `create*Renderer(canvas, {linear, assetBase})` and return
`resize`, `render`, `dispose`, `scene`, `info`. Renderer inputs include `time`, `low`,
`mid` and optional `bands[8]`; Matrix also accepts the native `matrixAudio[17]`.

Browser validation covers Gamma and Linear shader compilation, real audio/LRC,
paused seeking with scene changes, original 16:9 rendering and repeated switching.
No visual-fidelity percentage has been measured against an original device.

## First sample: FlowingIllusion

Open `http://localhost:8765/jmgo.html` using the existing demo server, or serve the
parent `lyric-wall/` folder with `python3 -m http.server 8765`.
No build step or CDN is required. The page loads only local resources.

## Source and reconstruction boundary

`flowing/provenance.json` records the APK, bundle and original fragment-body SHA-256.
`flowing/scene.json` retains serialized materials, camera, transforms, font and text
animation settings. `flowing/original.shader.txt` is the complete decoded shader export.
The fragment body in `flowing/fragment.glsl` retains the first Forward-pass GLES3
program's declarations and arithmetic, including precision qualifiers, discard,
30-column hash, audio displacement, scrolling normals and highlight composition.
Only Unity uniform-buffer declarations are flattened into ordinary WebGL uniforms.
The vertex wrapper uses the recovered mesh/UV, root Y rotation, root Z=9.39,
camera Y=1 and 60-degree FOV. The demo preserves a 16:9 viewport.
All three textures, repeat/bilinear sampling, mipmaps and OPPOSans-H font come
from the supplied JMGO APK. No assets from 氛围最新版1.apk are used.

Unresolved: native runtime `audioStrength` normalization/smoothing, runtime overrides
to the serialized lyric animation, and player color-space configuration. Gamma is
the demo default; Linear/sRGB is an explicit comparison option, not a verified
original setting. No extra bloom or invented postprocessing is applied (the scene's
camera setting disables postprocessing). Full TextMeshPro shaping and SDF underlay
are approximated with DOM text. The shared selectable glyph effects replace the
earlier source-inspired character scaling in this enhanced demo. Shader
time follows playback time and freezes on pause as a demo lifecycle decision.
Audio mode uses a 2048-point Web Audio analyser, frequency-aware low/mid bands and
an adjustable input gain. The silent preview uses a labeled deterministic input;
it does not pretend to be the original audio-analysis algorithm.

A percentage of visual fidelity has not been measured. Original-device recordings
of the same song/time are still needed for an honest comparison.

## Re-export

Requires UnityPy (used here: 1.25.2). From the repository root:

```sh
python3 scripts/export-jmgo-flowing.py /path/to/Arwen.apk
node --test tests/jmgo-timeline.test.mjs
```

The exporter verifies that the local extracted effect bundle matches the APK entry.
It reads resources without executing the Android application.

## RyanMusic integration

RyanMusic's 无界 entry now loads all six renderers through
`src/components/visualizer/jmgo/VisualizerJmgo.tsx`. The React adapter reads the
live playback MotionValue and mutable FFT array every frame, passes the analyser's
actual sample rate/FFT size, and applies the same rhythm tracker as the demo.
Song title and artist are passed to the Vinyl overlay. No synthetic input is used
in the player. The original default cover remains part of the recovered scene.

Scene, effect, font, local size, rhythm, input gain and Shapes preset are stored
in `ryanmusic-visualizer-tunings-v1`. Removed floating/stardust/kinetic/aurora IDs
normalize to flowing; old mode-only settings inherit new defaults. Global lyrics
size multiplies the local scene size, and the player lyric visibility toggle is
honored by both the shared caption and Vinyl overlay.

All rendering stays inside a centered 16:9 host. `mountJmgoScene` owns async
initialization, DOM, WebGL resources and cleanup; changing scenes preserves the
player's audio and time. `lyricPresentation` is passed from `scenes.js`, including
the readable lower captions for Mobius, Shapes and Elantra.

Run `npm run test:jmgo` from `web/`. The development fixture at
`/scripts/jmgo-preview.html` exercises the actual React component and settings
store with a silent local Web Audio signal and mutable FFT array. It is outside
`public/` and is not copied into production builds. `npm run build` copies the
runtime to `web-root/static/app/jmgo/`; relative module/font/asset URLs work under
both `/jmgo/` in development and `/static/app/jmgo/` in production.
