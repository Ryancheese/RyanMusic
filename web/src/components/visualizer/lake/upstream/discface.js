// The song's disc in the play view (2026-10-08): its cover, cut round, whole: no hole, nothing printed over it. The
// style of the song (genre.js) is a ring round the cover, in the same ornaments its record carries on the shelf
// (home.js ORN): rock a sunburst, pop a rosette of circles, electro broken circuit rings, hip-hop a grille of dots,
// anime four-point stars, soft interlaced waves, indie a strip of film perforations. The cover keeps its own picture
// edge to edge inside its circle; the ring is drawn outside it, in the song's colour.
const T2 = Math.PI * 2;

/** n: canvas size; style: genre.js style name; col: the song's colour (hex) */
export function coverDisc(img, style, col = '#D8B890', n = 1024) {
  const cv = document.createElement('canvas'); cv.width = cv.height = n;
  const c = cv.getContext('2d'), o = n / 2, R = o - 6, rc = R * .86, r0 = R * .885, r1 = R * .985;
  // the cover, whole within its circle
  c.save(); c.beginPath(); c.arc(o, o, rc, 0, T2); c.clip();
  c.fillStyle = '#1a1a1c'; c.fillRect(0, 0, n, n);
  if (img) { const s = Math.max(2 * rc / img.width, 2 * rc / img.height), w = img.width * s, h = img.height * s; c.drawImage(img, o - w / 2, o - h / 2, w, h); }
  c.restore();
  c.beginPath(); c.arc(o, o, rc, 0, T2); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 2.5; c.stroke();
  // the ring round it: a dark band, the style's ornament, a fine rim
  c.beginPath(); c.arc(o, o, r1, 0, T2); c.arc(o, o, rc + 2, T2, 0, true); c.fillStyle = 'rgba(10,10,12,.55)'; c.fill();
  // (the song's colour lifted a quarter of the way to white, so a dark colour still reads on the dark band)
  const m = /^#?([0-9a-f]{6})$/i.exec(String(col || '')), v = m ? parseInt(m[1], 16) : 0xD8B890, lift = x => Math.round(x + (255 - x) * .28);
  const ink = `rgb(${lift(v >> 16 & 255)},${lift(v >> 8 & 255)},${lift(v & 255)})`;
  c.save(); c.strokeStyle = ink; c.fillStyle = ink; c.globalAlpha = .95; c.lineWidth = 2;
  const mid = (r0 + r1) / 2, band = r1 - r0, at = (a, r) => [o + Math.cos(a) * r, o + Math.sin(a) * r];
  ({
    rock() { for (let i = 0; i < 96; i++) { const a = i / 96 * T2, l = i % 2 ? .45 : 1; const [x0, y0] = at(a, r0), [x1, y1] = at(a, r0 + band * l); c.lineWidth = i % 2 ? 1.5 : 3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); } },
    pop() { const k = 30; for (let i = 0; i < k; i++) { const [x, y] = at(i / k * T2, mid); c.beginPath(); c.arc(x, y, band * .62, 0, T2); c.stroke(); } },
    electro() { c.lineWidth = 2.5; for (const [r, k, s] of [[r0 + band * .2, 36, .3], [mid, 24, .5], [r1 - band * .2, 48, .15]]) for (let i = 0; i < k; i++) { if (((i * 7 + k) % 5) === 0) continue; const a0 = i / k * T2, a1 = a0 + T2 / k * (.82 - s * .3); c.beginPath(); c.arc(o, o, r, a0, a1); c.stroke(); const [x, y] = at(a1, r); c.fillRect(x - 3, y - 3, 6, 6); } },
    hiphop() { for (let ring = 0; ring < 3; ring++) { const r = r0 + band * (.2 + .3 * ring), k = Math.round(r * T2 / 14); for (let i = 0; i < k; i++) { const [x, y] = at((i + ring * .5) / k * T2, r); c.beginPath(); c.arc(x, y, 3.2, 0, T2); c.fill(); } } },
    anime() { const k = 28; for (let i = 0; i < k; i++) { const a = i / k * T2, [x, y] = at(a, mid), s = band * (i % 2 ? .28 : .46); c.beginPath(); for (let j = 0; j < 8; j++) { const b = j / 8 * T2, rr = j % 2 ? s * .22 : s; c.lineTo(x + Math.cos(b) * rr, y + Math.sin(b) * rr); } c.closePath(); c.fill(); } },
    soft() { c.lineWidth = 1.6; for (let w = 0; w < 3; w++) { c.beginPath(); for (let i = 0; i <= 720; i++) { const a = i / 720 * T2, r = mid + band * .38 * Math.sin(a * (18 + 6 * w) + w * 2.1); const [x, y] = at(a, r); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } },
    indie() { const k = 64; for (let i = 0; i < k; i++) { const a = i / k * T2, [x, y] = at(a, mid); c.save(); c.translate(x, y); c.rotate(a); const w = band * .42, h = band * .22; c.beginPath(); c.roundRect ? c.roundRect(-w / 2, -h / 2 - band * .0, w, h * 2.2, 3) : c.rect(-w / 2, -h, w, h * 2); c.fill(); c.restore(); } c.lineWidth = 1.2; for (const r of [r0 + 2, r1 - 2]) { c.beginPath(); c.arc(o, o, r, 0, T2); c.stroke(); } },
  }[style] || (() => { c.beginPath(); c.arc(o, o, mid, 0, T2); c.stroke(); }))();
  c.restore();
  c.beginPath(); c.arc(o, o, r1, 0, T2); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.stroke();
  return cv;
}
