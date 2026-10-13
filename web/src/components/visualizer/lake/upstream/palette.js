// Cover palette in the browser: the same rules as tools/spectra.py `palette()` (OKLab k-means, fixed lightness
// steps, greyscale covers fall back to F.S.C. ice), so an online song gets colours the same way a library song does.

const lin = c => (c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4));
const gam = c => (c <= .0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - .055);
function rgb2lab(r, g, b) {
  r = lin(r); g = lin(g); b = lin(b);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .808675766 * s];
}
function lab2rgb(L, a, b) {
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.707614701 * s].map(gam);
}
function lch(L, C, h) {
  let rgb;
  for (let k = 0; k < 40; k++) { const c = C * (1 - k / 40); rgb = lab2rgb(L, c * Math.cos(h), c * Math.sin(h)); if (rgb.every(v => v >= -.001 && v <= 1.001)) break; }
  return '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0').toUpperCase()).join('');
}
const relLum = hex => { const c = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const contrast = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };

export function paletteFromImage(img) {
  const N = 96, cv = Object.assign(document.createElement('canvas'), {width: N, height: N}), cx = cv.getContext('2d', {willReadFrequently: true});
  cx.drawImage(img, 0, 0, N, N);
  const d = cx.getImageData(0, 0, N, N).data, px = [];
  for (let i = 0; i < d.length; i += 4) px.push(rgb2lab(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255));
  const k = 7, order = px.map((p, i) => i).sort((a, b) => px[a][0] - px[b][0]);
  const cent = Array.from({length: k}, (_, j) => [...px[order[Math.round(j * (px.length - 1) / (k - 1))]]]);
  const idx = new Int32Array(px.length);
  for (let it = 0; it < 16; it++) {
    for (let i = 0; i < px.length; i++) { let b = 0, bd = 1e9; for (let j = 0; j < k; j++) { const dd = (px[i][0] - cent[j][0]) ** 2 + (px[i][1] - cent[j][1]) ** 2 + (px[i][2] - cent[j][2]) ** 2; if (dd < bd) { bd = dd; b = j; } } idx[i] = b; }
    for (let j = 0; j < k; j++) { let n = 0, s = [0, 0, 0]; for (let i = 0; i < px.length; i++) if (idx[i] === j) { n++; s[0] += px[i][0]; s[1] += px[i][1]; s[2] += px[i][2]; } if (n) cent[j] = s.map(v => v / n); }
  }
  const w = new Float64Array(k);
  for (const i of idx) w[i] += 1 / px.length;
  const C = cent.map(c => Math.hypot(c[1], c[2])), H = cent.map(c => Math.atan2(c[2], c[1]));
  const clusters = cent.map((c, j) => ({hex: lch(c[0], C[j], H[j]), weight: +w[j].toFixed(4), L: +c[0].toFixed(3), C: +C[j].toFixed(3), h: +(((H[j] * 180 / Math.PI) % 360 + 360) % 360).toFixed(1)})).filter(c => c.weight > 0).sort((a, b) => b.weight - a.weight);
  const score = C.map((c, j) => c * Math.pow(Math.max(w[j], 1e-6), .3) * (w[j] >= .025 ? 1 : 0));
  const ai = score.indexOf(Math.max(...score)), greyscale = C[ai] < .018;
  const ah = greyscale ? 225 * Math.PI / 180 : H[ai], ac = greyscale ? .07 : C[ai];
  let second = -1;
  for (const j of score.map((s, j) => j).sort((a, b) => score[b] - score[a])) {
    const dh = Math.abs((((H[j] - H[ai] + Math.PI) * 180 / Math.PI) % 360 + 360) % 360 - 180);
    if (j !== ai && score[j] > 0 && C[j] > .05 && dh > 40) { second = j; break; }
  }
  const emit = lch(.80, Math.min(Math.max(ac, ac < .05 ? .065 : .09), .17), ah), deep = lch(.42, Math.min(ac, .11), ah), light = lch(.94, .025, ah);
  let ramp = [lch(.58, Math.min(Math.max(ac, .07), .14), ah), emit, light];
  if (second >= 0) ramp = [emit, lch(.93, .02, ah), lch(.80, Math.min(Math.max(C[second], .09), .17), H[second])];
  let dom = 0; for (let j = 1; j < k; j++) if (w[j] > w[dom]) dom = j;
  return {clusters, greyscale, emit, deep, light, ramp, night: lch(.15, Math.min(.012, C[dom]), H[dom]), plane: emit,
    on_plane: contrast(emit, '#09090A') >= contrast(emit, '#F2F1EC') ? '#09090A' : '#F2F1EC'};
}

// Where the cover has the most detail: up to `k` points (0..1), used to frame close-ups. Measured, not chosen.
export function focusPoints(img, k = 3) {
  const N = 48, cv = Object.assign(document.createElement('canvas'), {width: N, height: N}), cx = cv.getContext('2d', {willReadFrequently: true});
  cx.drawImage(img, 0, 0, N, N);
  const d = cx.getImageData(0, 0, N, N).data, g = new Float32Array(N * N), e = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) g[i] = (.2126 * d[i * 4] + .7152 * d[i * 4 + 1] + .0722 * d[i * 4 + 2]) / 255;
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) e[y * N + x] = Math.abs(4 * g[y * N + x] - g[y * N + x - 1] - g[y * N + x + 1] - g[(y - 1) * N + x] - g[(y + 1) * N + x]);
  const b = new Float32Array(N * N), r = 6;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let s = 0; for (let j = Math.max(0, y - r); j <= Math.min(N - 1, y + r); j++) for (let i = Math.max(0, x - r); i <= Math.min(N - 1, x + r); i++) s += e[j * N + i]; b[y * N + x] = s; }
  const out = [];
  for (let n = 0; n < k; n++) {
    let bi = 0; for (let i = 1; i < N * N; i++) if (b[i] > b[bi]) bi = i;
    const x = bi % N, y = Math.floor(bi / N);
    out.push([Math.min(.8, Math.max(.2, x / N)), Math.min(.8, Math.max(.2, y / N))]);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if ((i - x) ** 2 + (j - y) ** 2 < 14 * 14) b[j * N + i] = 0;
  }
  return out;
}
