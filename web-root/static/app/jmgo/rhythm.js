// User-requested rhythm enhancement adapter, not recovered JMGO native audio logic.
// Time constants are seconds; input gains belong to the host and are not reapplied here.
const finite = value => Number.isFinite(value) ? Math.max(0, value) : 0;
const clamp = (value, max = 1) => Math.min(max, Math.max(0, value));
const follow = (value, target, dt, attack, release) => {
  const result = target + (value - target) * Math.exp(-dt / (target > value ? attack : release));
  return result < 0.0001 ? 0 : result;
};

export function rhythmAmount(value = 1) { return clamp(finite(value), 2); }

export function createRhythmTracker() {
  let lastTime = null, pausedLast = false, output = null;
  let envelope = Array(10).fill(0), peak = Array(10).fill(0.45);
  let fast = 0, baseline = 0, beat = 0, armed = true, lastOnset = -Infinity;
  const rawValues = ({ low, mid, bands }) => [finite(low), finite(mid),
    ...Array.from({ length: 8 }, (_, i) => finite(bands?.[i] ?? (i < 2 ? low : mid)))];
  const weightedEnergy = values => Math.sqrt(0.5 * values[0] ** 2 + 0.25 * values[1] ** 2
    + 0.25 * values.slice(2).reduce((sum, value) => sum + value * value, 0) / 8);
  const normalized = values => values.map((value, i) => {
    // A fixed floor prevents noise-only passages from being amplified to full scale.
    const gated = Math.max(0, value - 0.012);
    return clamp(gated / Math.max(0.38, peak[i] * 0.92)) ** 1.15;
  });
  function reset(values, time) {
    peak = values.map(value => Math.max(0.45, value));
    envelope = normalized(values);
    fast = baseline = weightedEnergy(envelope); beat = 0; armed = true; lastOnset = time;
    output = { low: envelope[0], mid: envelope[1], bands: envelope.slice(2), energy: fast, beat: 0, onset: false };
    return output;
  }
  return {
    update(snapshot = {}) {
      const time = Number.isFinite(snapshot.time) ? snapshot.time : 0;
      const values = rawValues(snapshot);
      const dt = lastTime === null ? 0 : time - lastTime;
      const discontinuity = lastTime === null || dt < 0 || dt > 0.5
        || ((snapshot.paused || pausedLast) && Math.abs(dt) > 0.05);
      if (discontinuity) {
        lastTime = time; pausedLast = !!snapshot.paused;
        return reset(values, time);
      }
      lastTime = time; pausedLast = !!snapshot.paused;
      if (snapshot.paused || dt === 0) {
        // Freeze envelopes, but onset is a one-frame event and must not retrigger.
        output = { ...output, onset: false };
        return output;
      }
      peak = peak.map((value, i) => Math.max(0.45, values[i], value * Math.exp(-dt / 3.2)));
      const targets = normalized(values);
      envelope = envelope.map((value, i) => follow(value, targets[i], dt, 0.018, 0.16));
      const currentEnergy = weightedEnergy(targets);
      fast = follow(fast, currentEnergy, dt, 0.012, 0.055);
      baseline = follow(baseline, currentEnergy, dt, 0.28, 0.25);
      const flux = fast - baseline;
      if (flux < 0.018) armed = true;
      const onset = armed && currentEnergy > 0.09 && flux > Math.max(0.045, baseline * 0.2) && time - lastOnset >= 0.14;
      beat *= Math.exp(-dt / 0.17);
      if (onset) { beat = clamp(0.65 + flux * 1.8); lastOnset = time; armed = false; }
      if (beat < 0.0001) beat = 0;
      output = { low: envelope[0], mid: envelope[1], bands: envelope.slice(2),
        energy: clamp(weightedEnergy(envelope)), beat, onset };
      return output;
    },
  };
}
