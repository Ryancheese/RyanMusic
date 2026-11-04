/** Build ordered lyric blocks from measured wrapped heights, never a guessed line count. */
export function buildLyricBlockLayout(profiles, activeIndex, gap = 12) {
  const starts = [], heights = [], centers = [];
  const spacing = Number.isFinite(gap) ? Math.max(0, gap) : 12;
  let cursor = 0;
  profiles.forEach((profile, index) => {
    const value = index === activeIndex ? profile.active : profile.inactive;
    const height = Number.isFinite(value) ? Math.max(0, value) : 0;
    starts.push(cursor); heights.push(height); centers.push(cursor + height / 2);
    cursor += height + spacing;
  });
  return { starts, heights, centers, totalHeight: Math.max(0, cursor - (profiles.length ? spacing : 0)) };
}

export function findActiveLyricIndex(lines, time) {
  let low = 0, high = lines.length - 1, result = -1;
  while (low <= high) {
    const index = (low + high) >> 1;
    if (lines[index].startTime <= time) { result = index; low = index + 1; }
    else high = index - 1;
  }
  return result;
}

/** A deterministic common scroll offset keeps every adjacent block separated while seeking. */
export function lyricScrollOffset(layout, { activeIndex, time, lineStart = 0, lineEnd = Infinity, duration = 0.6667, anchor = 0 }) {
  if (!layout.centers.length) return 0;
  const current = Math.max(0, Math.min(layout.centers.length - 1, activeIndex));
  const previous = Math.max(0, current - 1);
  const target = layout.centers[current] - anchor;
  if (current === 0 || duration <= 0) return target;
  const lineDuration = Number.isFinite(lineEnd) ? Math.max(0, lineEnd - lineStart) : Infinity;
  const movementDuration = Math.min(Math.max(0, duration), lineDuration);
  const progress = movementDuration > 0 ? Math.min(1, Math.max(0, (time - lineStart) / movementDuration)) : 1;
  const from = layout.centers[previous] - anchor;
  const value = from + (target - from) * progress;
  return Math.min(layout.centers.at(-1) - anchor, Math.max(layout.centers[0] - anchor, value));
}

function sameLines(lines, cached) {
  return lines.length === cached.length && lines.every((line, i) => line.fullText === cached[i].text && line.startTime === cached[i].start && line.endTime === cached[i].end);
}

/**
 * DOM measurement controller. Presentation helpers are supplied by the host so the
 * pure layout functions above remain usable in Node tests without browser globals.
 */
export function createVinylLyricLayout(windowNode, { setLyricText, animateLyricText, getLyricFont }) {
  const doc = windowNode.ownerDocument, fontSet = doc.fonts;
  const measureHost = doc.createElement('div');
  measureHost.style.cssText = 'position:absolute;left:0;top:0;width:100%;visibility:hidden;pointer-events:none;';
  measureHost.setAttribute('aria-hidden', 'true'); windowNode.append(measureHost);
  let disposed = false, fontRevision = 0, cachedLines = [], blocks = [], profiles = [];
  let measuredKey = '', presentedKey = '', presentedIndex = -2, laidOutIndex = -2, layout = null, layoutGap = -1;
  const loadedFonts = new Set(), pendingFonts = new Map();
  const onFontLoad = () => { if (!disposed) { fontRevision++; measuredKey = ''; } };
  fontSet?.addEventListener?.('loadingdone', onFontLoad);
  fontSet?.ready?.then(onFontLoad).catch(() => {});

  function ensureFont(font) {
    const selected = getLyricFont(font), key = `${selected.family}|${selected.weight}`;
    if (!fontSet || loadedFonts.has(key)) return true;
    const descriptor = `${selected.weight} 16px ${selected.family}`;
    if (fontSet.check(descriptor)) { loadedFonts.add(key); return true; }
    if (!pendingFonts.has(key)) {
      const promise = fontSet.load(descriptor).catch(() => []).then(() => {
        if (disposed) return;
        loadedFonts.add(key); pendingFonts.delete(key); onFontLoad();
      });
      pendingFonts.set(key, promise);
    }
    return false;
  }
  function blockNode() {
    const node = doc.createElement('div');
    node.className = 'jmgo-vinyl-line';
    node.style.cssText = 'position:absolute;left:0;top:0;width:100%;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;overflow:visible;box-sizing:border-box;margin:0;padding:0;';
    return node;
  }
  function prepare(node, text, { effect, font, active, baseSize, activeScale }) {
    const size = baseSize * (active ? activeScale : 1);
    node.style.fontSize = `${size}px`;
    node.style.minHeight = `${size * 1.35}px`;
    node.style.color = active ? '#fff' : 'rgba(255,255,255,0.4)';
    setLyricText(node, text, { effect: active ? effect : 'none', font, active });
  }
  function update(snapshot, geometry) {
    if (disposed || snapshot.showText === false || !windowNode.isConnected) return;
    const lines = snapshot.lines ?? [], t = Number.isFinite(snapshot.time) ? snapshot.time : 0;
    const font = snapshot.lyricFont ?? 'modern', effect = snapshot.lyricEffect ?? 'focus';
    const scale = Number.isFinite(snapshot.fontScale) && snapshot.fontScale > 0 ? snapshot.fontScale : 1;
    const { width, height, px, activeScale = 1.2, padding = 55, duration = 0.6667, anchor = height / 2 } = geometry;
    if (!(width > 0 && height > 0 && px > 0)) return;
    // Never cache fallback-font or disconnected measurements. Loading completion
    // invalidates both measured profiles and positions, including paused playback.
    if (!ensureFont(font)) { windowNode.style.visibility = 'hidden'; return; }
    windowNode.style.visibility = 'visible';
    const baseSize = 66 * px * scale;
    const activeIndex = findActiveLyricIndex(lines, t), contentChanged = !sameLines(lines, cachedLines);
    const style = { effect, font, baseSize, activeScale };
    const styleKey = [width, baseSize, activeScale, effect, font, fontRevision].join('|');
    if (contentChanged) {
      blocks.forEach(node => node.remove());
      blocks = lines.map((line, index) => {
        const node = blockNode(); node.dataset.lineIndex = index; windowNode.insertBefore(node, measureHost); return node;
      });
      cachedLines = lines.map(line => ({ text: line.fullText, start: line.startTime, end: line.endTime }));
      measuredKey = ''; presentedKey = ''; laidOutIndex = -2;
    }
    if (measuredKey !== styleKey) {
      // Both variants are measured in a batch. The active font/effect may wrap at
      // different places, so its full block is reserved before calculating offsets.
      blocks.forEach((node, i) => prepare(node, cachedLines[i].text, { ...style, active: false }));
      const probes = cachedLines.map(line => {
        const node = blockNode(); node.style.position = 'relative';
        prepare(node, line.text, { ...style, active: true }); measureHost.append(node); return node;
      });
      const inactive = blocks.map(node => Math.ceil(node.getBoundingClientRect().height));
      const active = probes.map(node => Math.ceil(node.getBoundingClientRect().height));
      profiles = inactive.map((value, i) => ({ inactive: value, active: active[i] }));
      probes.forEach(node => node.remove()); measuredKey = styleKey; presentedKey = ''; laidOutIndex = -2;
    }
    const presentationChanged = presentedKey !== styleKey;
    blocks.forEach((node, i) => {
      const active = i === activeIndex;
      if (presentationChanged || i === activeIndex || i === presentedIndex) {
        // Rebuild span content only when its active state/style changed. Animation
        // runs separately so glyph reveal never duplicates the full lyric block.
        if (presentationChanged || activeIndex !== presentedIndex) prepare(node, cachedLines[i].text, { ...style, active });
        node.setAttribute('aria-current', active ? 'true' : 'false');
        if (!active) animateLyricText(node, { time: t, lineStart: lines[i].startTime, lineEnd: lines[i].endTime, beat: 0, paused: snapshot.paused, active: false });
      }
    });
    presentedKey = styleKey; presentedIndex = activeIndex;
    // The gap also reserves the shared active effects' small glyph motion/scale.
    const gap = Math.max(12, padding * px, baseSize * activeScale * 0.06 + 8);
    if (laidOutIndex !== activeIndex || layoutGap !== gap) {
      layout = buildLyricBlockLayout(profiles, activeIndex, gap); laidOutIndex = activeIndex; layoutGap = gap;
    }
    const current = lines[activeIndex];
    const nextStart = lines[activeIndex + 1]?.startTime;
    const lineEnd = Number.isFinite(current?.endTime) ? current.endTime : nextStart ?? Infinity;
    const offset = lyricScrollOffset(layout, { activeIndex, time: t, lineStart: current?.startTime ?? 0, lineEnd, duration, anchor });
    blocks.forEach((node, i) => {
      const top = layout.starts[i] - offset; node.style.top = `${top}px`;
      node.setAttribute('aria-hidden', top + layout.heights[i] < 0 || top > height ? 'true' : 'false');
    });
    if (activeIndex >= 0) animateLyricText(blocks[activeIndex], {
      time: t, lineStart: current.startTime, lineEnd, beat: snapshot.beat ?? snapshot.low ?? 0,
      paused: snapshot.paused, active: true,
    });
  }
  return { update, dispose() {
    if (disposed) return; disposed = true;
    fontSet?.removeEventListener?.('loadingdone', onFontLoad); blocks.forEach(node => node.remove()); measureHost.remove();
  } };
}
