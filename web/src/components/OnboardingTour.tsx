import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { visibleOnboardingSteps, type OnboardingScene } from '../onboarding';
import { useOnboardingStore } from '../store/onboardingStore';

interface OnboardingTourProps {
  isDaylight: boolean;
  loggedIn: boolean;
  hasTrack: boolean;
  onScene: (scene: OnboardingScene) => void;
  onOpenPanel: () => void;
}

interface HoleRect {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

const CARD_W = 320;
const PAD = 14;

function readHole(target?: string): HoleRect | null {
  if (!target) return null;
  const nodes = document.querySelectorAll(`[data-tour="${target}"]`);
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const box = node.getBoundingClientRect();
    if (box.width < 4 || box.height < 4) continue;
    const radius = Math.min(22, Number.parseFloat(style.borderRadius) || 16);
    return {
      top: box.top - 8,
      left: box.left - 8,
      width: box.width + 16,
      height: box.height + 16,
      radius: radius + 8,
    };
  }
  return null;
}

function cardPosition(hole: HoleRect | null) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_W, vw - 24);
  if (!hole || hole.width * hole.height > vw * vh * 0.4) {
    return { top: Math.max(24, vh / 2 - 110), left: Math.max(12, (vw - width) / 2), width };
  }
  const below = hole.top + hole.height + PAD;
  const above = hole.top - PAD - 168;
  const preferBelow = below + 180 < vh - 16 || above < 16;
  const top = preferBelow ? Math.min(below, vh - 196) : Math.max(16, above);
  let left = hole.left + hole.width / 2 - width / 2;
  left = Math.min(Math.max(12, left), vw - width - 12);
  return { top, left, width };
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isDaylight,
  loggedIn,
  hasTrack,
  onScene,
  onOpenPanel,
}) => {
  const active = useOnboardingStore((state) => state.active);
  const stepIndex = useOnboardingStore((state) => state.stepIndex);
  const next = useOnboardingStore((state) => state.next);
  const prev = useOnboardingStore((state) => state.prev);
  const skip = useOnboardingStore((state) => state.skip);
  const steps = useMemo(
    () => visibleOnboardingSteps({ loggedIn, hasTrack }),
    [hasTrack, loggedIn],
  );
  const step = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))];
  const [hole, setHole] = useState<HoleRect | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!active || !step) return;
    onScene(step.scene);
    if (step.openPanel) onOpenPanel();
  }, [active, onOpenPanel, onScene, step]);

  useLayoutEffect(() => {
    if (!active || !step) return;
    let alive = true;
    const sync = () => {
      if (!alive) return;
      setHole(readHole(step.target));
    };
    sync();
    const timer = window.setTimeout(sync, 280);
    const delayed = window.setTimeout(sync, 520);
    window.addEventListener('resize', sync);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearTimeout(delayed);
      window.removeEventListener('resize', sync);
    };
  }, [active, step, tick]);

  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => setTick((value) => value + 1), 400);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') skip();
      if (event.key === 'ArrowRight' || event.key === 'Enter') next(steps.length);
      if (event.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, prev, skip, steps.length]);

  if (!active || !step) return null;

  const card = cardPosition(hole);
  const panel = isDaylight ? 'bg-white text-black' : 'bg-zinc-900 text-white';
  const last = stepIndex >= steps.length - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <div className="pointer-events-auto absolute inset-0" aria-hidden>
        {hole ? (
          <div
            className="absolute"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
              borderRadius: hole.radius,
              boxShadow: '0 0 0 9999px rgba(8, 10, 14, 0.58)',
              outline: '2px solid color-mix(in srgb, var(--text-accent) 80%, white)',
              outlineOffset: 0,
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-black/50" />
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
          className={`pointer-events-auto absolute rounded-3xl border border-white/12 p-4 shadow-2xl ${panel}`}
          style={{ top: card.top, left: card.left, width: card.width }}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-1 text-[11px] tracking-wide opacity-45">
            {stepIndex + 1} / {steps.length}
          </div>
          <h2 id="onboarding-title" className="text-[15px] font-semibold tracking-tight">
            {step.title}
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed opacity-70">{step.body}</p>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={skip}
              className="rounded-full px-3 py-1.5 text-[12px] opacity-50 hover:opacity-90"
            >
              跳过
            </button>
            <div className="ml-auto flex items-center gap-2">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={prev}
                  className={`rounded-full px-3 py-1.5 text-[12px] ${isDaylight ? 'bg-black/6' : 'bg-white/8'}`}
                >
                  上一步
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => next(steps.length)}
                className="btn-accent rounded-full px-4 py-1.5 text-[12px] font-medium"
              >
                {last ? '开始使用' : '下一步'}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default OnboardingTour;
