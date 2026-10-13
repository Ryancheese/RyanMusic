// Catalogue facts for labels/filtering only. Legacy genre/neStyles/optic remain
// the performance inputs in genre.js. No camera, look, timing or motion rules.
export const DIMENSIONS = ['genre', 'context', 'language', 'mood', 'scene', 'instrument', 'business'];
const CONTEXT = new Set(['soundtrack', 'video game music', 'anime', 'anime soundtrack', 'film score', 'trailer music']);
const INSTRUMENT = new Set(['piano', 'orchestral', 'chamber music', 'a cappella', 'instrumental']);
const SCENES = new Set(['KTV', '夜店', '酒吧', '咖啡厅', '婚礼', '旅游', '舞会', '舞蹈', '举铁', '极限运动',
  '散步', '家务', '通勤', '有氧', '驾车', '瑜伽', '运动', '学习', '工作', '睡前', '露营', '狂欢']);
const MOODS = new Set(['治愈', '欢快', '自信', '思念', '浪漫', '平静', '放松', '活力', '悲伤', '甜蜜', '孤独', '苦情', '热血励志']);
const normalize = (raw, table) => {
  const tag = String(raw).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
  const aliases = Object.fromEntries(Object.entries(table.aliases || {}).map(([k, v]) => [k.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' '), v]));
  return aliases[tag] || tag;
};
const blank = () => ({version: 1, ...Object.fromEntries(DIMENSIONS.map(k => [k, []])), candidates: [], catalogPrimary: null,
  review: {missingGenre: false, artistOnly: false, crossCatalogConflict: false, reasons: []}});
const evidence = (source, raw, extra = {}) => ({source, raw: String(raw), scope: 'song-catalog', status: 'catalogue', ...extra});
function add(c, dimension, tag, ev) {
  if (!tag) return;
  let item = c[dimension].find(x => x.tag === tag);
  if (!item) c[dimension].push(item = {tag, evidence: []});
  if (!item.evidence.some(x => JSON.stringify(x) === JSON.stringify(ev))) item.evidence.push(ev);
}

/** Only explicitly supplied platform metadata is classified. Unknown stays unknown. */
export function classifyNetEase(about = {}, map, table, provenance = {}) {
  const c = blank();
  for (const raw of about.styles || []) {
    const mapped = String(raw).split('-').reverse().map(p => map[p.trim()]).find(Boolean);
    if (!mapped) continue;
    const tag = normalize(mapped, table), ev = evidence('netease:song', raw, {normalized: tag, ...provenance});
    add(c, CONTEXT.has(tag) ? 'context' : 'genre', tag, ev);
    if (INSTRUMENT.has(tag)) add(c, 'instrument', tag, ev);
  }
  if (about.language === '纯音乐') add(c, 'instrument', 'instrumental', evidence('netease:language', about.language, provenance));
  else if (about.language) for (const part of about.language.split(/[、,，/;；]/)) {
    if (part.trim()) add(c, 'language', part.trim(), evidence('netease:language', about.language, provenance));
  }
  for (const raw of about.tags || []) {
    const tag = String(raw), dim = SCENES.has(tag) ? 'scene' : MOODS.has(tag) ? 'mood' : 'business';
    add(c, dim, tag, evidence('netease:biz-tag', raw, provenance));
  }
  const rank = tag => Math.max(0, ...Object.values(table.styles).map(s => s.tags[tag] || 0));
  // All of these have the same song-catalog scope. Stable input order resolves
  // specificity ties, matching tools/catalog_tags.py exactly.
  const supported = c.genre.filter(x => rank(x.tag));
  if (supported.length) c.catalogPrimary = supported.reduce((a, b) => rank(b.tag) > rank(a.tag) ? b : a).tag;
  const reasons = [];
  if (!c.genre.length) reasons.push(c.context.length ? 'musical-genre-not-declared' : 'catalogue-genre-missing');
  if (c.genre.some(x => !rank(x.tag))) reasons.push('unmapped-catalogue-genre');
  c.review = {missingGenre: !c.genre.length, artistOnly: false, crossCatalogConflict: false, reasons};
  return c;
}

export function catalogLabel(track) {
  const c = track?.classification;
  if (!c) return track?.genre || '未标注曲风';
  return c.catalogPrimary || c.genre?.[0]?.tag || (c.context?.length ? c.context.map(x => x.tag).join(' · ') : '未标注曲风');
}

/** A plain text explanation suitable for an existing title/label, not a new UI. */
export function catalogDescription(track) {
  const c = track?.classification;
  if (!c) return catalogLabel(track);
  const names = {genre: '曲风', context: '作品语境', language: '语言', mood: '情绪', scene: '场景', instrument: '乐器／声乐', business: '平台业务标签'};
  const lines = DIMENSIONS.filter(k => c[k]?.length).map(k => `${names[k]}：${c[k].map(x => x.tag).join(' · ')}`);
  if (c.review?.missingGenre) lines.push('音乐曲风未声明');
  if (c.candidates?.length) lines.push(`艺人级候选：${c.candidates.map(x => x.tag).join(' · ')}（未作为歌曲事实）`);
  return lines.join('\n') || '未标注曲风';
}
