// Playback-time typography: seeking and pausing produce the same glyph state.
export const LYRIC_FONTS = [
  { id: 'modern', label: '现代黑体', family: 'JMGOBold, sans-serif', weight: '800' },
  { id: 'light', label: '轻盈细体', family: 'JMGOLight, sans-serif', weight: '300' },
  { id: 'poster', label: '海报标题黑', family: 'JMGOHeadline, JMGOBold, sans-serif', weight: '800' },
  { id: 'serif', label: '宋体艺术字', family: 'JMGOEditorial, JMGOBold, serif', weight: '900' },
];
export const LYRIC_EFFECTS = [
  { id: 'clean', label: '清晰字幕' },
  { id: 'focus', label: '逐字聚焦' },
  { id: 'neon', label: '霓虹描边' },
  { id: 'poster', label: '海报字块' },
  { id: 'karaoke', label: '流光高亮' },
];
export function getLyricFont(id) { return LYRIC_FONTS.find(font => font.id === id) ?? LYRIC_FONTS[0]; }
const cache = new WeakMap();
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;
const clamp = value => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function lyricProgress(time, lineStart, lineEnd) {
  const start = Number.isFinite(lineStart) ? lineStart : 0;
  const duration = Number.isFinite(lineEnd) && lineEnd > start ? lineEnd - start : 5;
  return clamp((time - start) / Math.max(0.15, duration));
}

/** Text/font/effect changes alter flow only here, before a host measures its line. */
export function setLyricText(node, text, { effect = 'focus', font = 'modern', active = true } = {}) {
  text = String(text ?? '');
  const selected = LYRIC_EFFECTS.some(item => item.id === effect) ? effect : 'clean';
  const resolved = active ? selected : 'clean';
  const key = JSON.stringify([text, resolved, font, active]);
  if (cache.get(node)?.key === key) return;
  const typography = getLyricFont(font);
  node.classList.add('lyric-text');
  node.dataset.lyricEffect = resolved;
  node.dataset.lyricFont = typography.id;
  node.dataset.lyricActive = String(active);
  node.style.fontFamily = typography.family;
  node.style.fontWeight = typography.weight;
  const chars = segmenter ? [...segmenter.segment(text)].map(part => part.segment) : Array.from(text);
  const glyphs = [];
  // Huge or inactive lines keep plain text; typography remains available without a large RAF cost.
  if (!active || resolved === 'clean' || chars.length > 180) node.textContent = text;
  else {
    const fragment = document.createDocumentFragment();
    for (const char of chars) {
      if (char === '\n' || char === '\r\n') { fragment.append(document.createElement('br')); continue; }
      const span = document.createElement('span'); span.className = 'lyric-fx-char'; span.textContent = char;
      fragment.append(span); glyphs.push(span);
    }
    node.replaceChildren(fragment);
  }
  cache.set(node, { key, glyphs, effect: resolved });
}

/** Only paint/transforms change here: measured wrapping and block heights stay stable. */
export function animateLyricText(node, { time = 0, lineStart = 0, lineEnd, beat = 0, active = true } = {}) {
  const state = cache.get(node);
  if (!state) return;
  const progress = lyricProgress(time, lineStart, lineEnd);
  node.style.setProperty('--lyric-progress', String(progress));
  node.style.setProperty('--lyric-beat', String(clamp(beat)));
  if (!active || state.effect === 'clean') return;
  const pulse = clamp(beat), elapsed = Math.max(0, time - lineStart), count = state.glyphs.length;
  state.glyphs.forEach((glyph, index) => {
    const entry = clamp((elapsed - index * Math.min(0.028, 0.32 / Math.max(1,count))) / 0.24);
    const highlight = clamp(progress * count - index);
    let y = 0, scale = 1, skew = 0;
    glyph.style.opacity = '1'; glyph.style.color = '';
    if (state.effect === 'focus') {
      y = (1 - entry) * 4; scale = 0.96 + entry * 0.04 + pulse * 0.02;
      glyph.style.opacity = String(0.35 + entry * 0.65);
    } else if (state.effect === 'poster') {
      y = (index % 2 ? 1 : -1) * pulse * 1.6; skew = -6;
      scale = 1 + pulse * 0.018;
    } else if (state.effect === 'neon') {
      scale = 1 + pulse * 0.025;
    } else if (state.effect === 'karaoke') {
      glyph.style.color = highlight > 0 ? '#ffe6a4' : 'rgba(255,255,255,0.64)';
      scale = 1 + highlight * pulse * 0.02;
    }
    glyph.style.transform = `translateY(${y.toFixed(2)}px) skewX(${skew}deg) scale(${scale.toFixed(4)})`;
  });
}
