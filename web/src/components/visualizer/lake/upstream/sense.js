// Lyric imagery: which images a song's words call up, so the stage can draw them as the words are sung.
// Method learned from Folia's theme step (a model reads the lyrics once per song and returns keyword colours and
// a few visual concepts; the renderer matches keywords as they are sung). Ours:
//   · a local lexicon (English / Japanese / Chinese) always works, offline, deterministic;
//   · if the local service has a DeepSeek key, /api/sense returns the model's reading of the whole song in the
//     same vocabulary (keywords with colour, per-line images, song motifs) and it replaces the lexicon result.
// The vocabulary is fixed: every image here has a drawing and a particle behaviour in imagery.js.

export const IMAGES = ['star', 'moon', 'sun', 'sky', 'night', 'light', 'sea', 'rain', 'snow', 'wind', 'flower', 'fire',
  'heart', 'wing', 'road', 'time', 'dream', 'city', 'tears', 'door', 'world', 'galaxy', 'fireworks', 'song', 'eye',
  'hand', 'butterfly', 'tree', 'mountain', 'home', 'mirror', 'shadow', 'smoke', 'ring', 'crown', 'letter', 'train', 'ship', 'candle', 'glass', 'diamond', 'lightning', 'rainbow', 'phone', 'car'];

// natural hue of each image (OKLCh degrees) and how much it wants colour; the song's palette decides the rest
export const HUE = {star: [85, .08], moon: [95, .04], sun: [65, .15], sky: [235, .1], night: [270, .1], light: [80, .07], sea: [220, .13],
  rain: [230, .08], snow: [220, .03], wind: [180, .06], flower: [350, .15], fire: [40, .19], heart: [15, .17], wing: [200, .06], road: [60, .05],
  time: [75, .06], dream: [300, .11], city: [260, .09], tears: [210, .09], door: [70, .05], world: [190, .1], galaxy: [290, .14], fireworks: [30, .18], song: [160, .09], eye: [200, .08],
  hand: [50, .05], butterfly: [310, .12], tree: [145, .11], mountain: [210, .05], home: [60, .08], mirror: [200, .04], shadow: [280, .05], smoke: [250, .03], ring: [85, .1], crown: [85, .14], letter: [70, .05], train: [240, .07],
  ship: [215, .08], candle: [55, .15], glass: [20, .1], diamond: [200, .07], lightning: [95, .13], rainbow: [140, .14], phone: [190, .08], car: [25, .1]};

// Latin entries are word stems (matched at word start, so "stars", "starlight" match "star"); CJK entries are substrings.
const LEX = {
  star: ['star', 'stellar', 'twinkl', '星', 'ほし', 'スター', '☆'],
  moon: ['moon', 'lunar', '月', 'つき', 'ムーン'],
  sun: ['sun', 'sunshine', 'sunrise', 'sunset', 'dawn', '太陽', '日差', '陽', '太阳', '阳光', '朝日', '夕日', '夕陽'],
  sky: ['sky', 'skies', 'heaven', 'cloud', '空', 'そら', '天空', '雲', '云', '青空'],
  night: ['night', 'midnight', 'dark', 'tonight', '夜', 'よる', '闇', '黑夜', '深夜', '今夜'],
  light: ['light', 'shine', 'shining', 'glow', 'gleam', 'spark', '光', 'ひかり', '輝', '眩', '灯'],
  sea: ['sea', 'ocean', 'wave', 'tide', 'shore', 'beach', 'drown', '海', 'うみ', '波', '浪', '潮', '岸'],
  rain: ['rain', 'storm', 'drizzle', '雨', 'あめ'],
  snow: ['snow', 'winter', 'frozen', 'ice', 'cold', '雪', 'ゆき', '冬', '氷', '冰', '寒'],
  wind: ['wind', 'breeze', 'breath', 'blow', '風', 'かぜ', '风', '息'],
  flower: ['flower', 'bloom', 'blossom', 'rose', 'petal', 'garden', '花', 'はな', '桜', 'さくら', '樱', '咲', '薔薇', '蕾'],
  fire: ['fire', 'flame', 'burn', 'blaze', 'ember', 'heat', '火', '炎', '燃', '焰', '熱'],
  heart: ['heart', 'heartbeat', 'kiss', '心臓', 'こころ', 'ハート', '鼓動', '胸', '心'],
  wing: ['wing', 'fly', 'flying', 'flight', 'bird', 'feather', 'soar', '翼', '飛', '鳥', '羽', '飞', '鸟', 'つばさ'],
  road: ['road', 'street', 'highway', 'journey', '道', '路', '旅', '帰り道'],
  time: ['clock', 'forever', 'tomorrow', 'yesterday', 'hour', '時計', '時間', '永遠', '明日', '昨日', '时间', '永远', '瞬間', '刹那'],
  dream: ['dream', 'sleep', 'wish', 'fantasy', '夢', 'ゆめ', '梦', '眠', '願'],
  city: ['city', 'town', 'neon', 'tower', '街', 'まち', '都会', '城市', '都市', 'ビル'],
  tears: ['tear', 'cry', 'crying', 'weep', '涙', 'なみだ', '泪', '哭', '泣'],
  door: ['door', 'window', 'gate', 'key', '扉', '窓', 'ドア', '门', '窗', '鍵'],
  world: ['world', 'earth', 'planet', '世界', '地球', 'せかい'],
  galaxy: ['galaxy', 'universe', 'cosmos', 'space', 'orbit', '宇宙', '銀河', '银河', '星座'],
  fireworks: ['firework', '花火', 'はなび', '烟花', '烟火'],
  song: ['song', 'sing', 'melody', 'music', '歌', '唄', 'うた', 'メロディ', '旋律'],
  eye: ['eye', 'gaze', '瞳', '眼', '目'],
  hand: ['hand', 'finger', 'touch', 'hold', 'grasp', '手のひら', '指先', '掌', '握', '触れ', '牵手', '手心'],
  butterfly: ['butterfl', '蝶', '蝴蝶'],
  tree: ['tree', 'forest', 'leaf', 'leaves', 'branch', '森', '木漏れ', '葉', '树', '森林', '叶', '枝'],
  mountain: ['mountain', 'hill', 'summit', 'cliff', '山', '丘', '峰', '崖'],
  home: ['home', 'house', 'room', 'roof', '家', '部屋', '房间', '屋根', '帰る場所'],
  mirror: ['mirror', 'reflection', '鏡', '镜'],
  shadow: ['shadow', 'silhouette', '影'],
  smoke: ['smoke', 'cigarette', 'fog', 'mist', 'haze', '煙', '烟雾', '霧', '雾', 'タバコ'],
  ring: ['ring', 'promise', 'wedding', 'vow', '指輪', '戒指', '約束', '约定', '誓'],
  crown: ['crown', 'king', 'queen', 'throne', '王冠', '女王', '王様', '国王'],
  letter: ['letter', 'message', 'envelope', '手紙', 'メッセージ', '書信', '写信', '来信'],
  train: ['train', 'station', 'railway', 'subway', '電車', '列車', '駅', '车站', '火车', '地铁'],
  ship: ['ship', 'boat', 'sail', 'harbor', 'harbour', 'anchor', '船', '舟', '港', '帆'],
  candle: ['candle', 'lantern', 'lamp', 'ろうそく', '蝋燭', '蜡烛', '灯籠', 'ランプ'],
  glass: ['glass', 'wine', 'champagne', 'cocktail', 'drunk', 'whiskey', 'グラス', 'お酒', '酒', '乾杯', '干杯', 'ワイン', '酔'],
  diamond: ['diamond', 'jewel', 'crystal', 'gem', 'gold', 'treasure', 'ダイヤ', '宝石', '钻石', '結晶', '水晶', '宝物', '黄金'],
  lightning: ['lightning', 'thunder', 'electric', '稲妻', '雷', '闪电', '電撃'],
  rainbow: ['rainbow', 'prism', '虹', '彩虹'],
  phone: ['phone', 'telephone', 'call', '電話', '电话', 'スマホ', '携帯', '既読', '着信'],
  car: ['car', 'drive', 'driving', 'ride', 'taxi', 'engine', '車', '车', 'ドライブ', 'タクシー'],
};
// short Latin stems that would match too much at word start: require the whole word
const WHOLE = new Set(['sun', 'key', 'ice', 'eye', 'fly', 'sea', 'sky', 'heat', 'cold', 'blow', 'dark', 'wish', 'town', 'kiss', 'cry', 'tear', 'song', 'sing', 'hour', 'space', 'wave', 'light', 'spark', 'music', 'gaze', 'rose', 'door', 'gate', 'bird', 'fire', 'burn', 'snow', 'rain', 'wind', 'moon', 'star', 'night', 'dream', 'city', 'road', 'world',
  'hand', 'hold', 'tree', 'leaf', 'hill', 'home', 'house', 'room', 'roof', 'fog', 'mist', 'haze', 'ring', 'vow', 'king', 'queen', 'train', 'ship', 'boat', 'sail', 'lamp', 'glass', 'wine', 'drunk', 'gem', 'gold', 'call', 'car', 'drive', 'ride', 'taxi']);
const PLURAL = /(?:s|es|ed|ing|in'|y|ies)$/;

const CJK_RE = /[぀-ヿ㐀-鿿豈-﫿]/;
const latinEntries = [], cjkEntries = [];
for (const [img, list] of Object.entries(LEX)) for (const w of list) (CJK_RE.test(w) || /[☆]/.test(w) ? cjkEntries : latinEntries).push([w, img]);
cjkEntries.sort((a, b) => b[0].length - a[0].length);

// find images in one line of text: returns [{a, b, img}] character ranges (longest match wins, no overlaps)
export function findImages(text) {
  const out = [], taken = new Uint8Array(text.length);
  for (const [w, img] of cjkEntries) {
    let i = text.indexOf(w);
    while (i >= 0) { let free = true; for (let k = i; k < i + w.length; k++) if (taken[k]) free = false; if (free) { out.push({a: i, b: i + w.length, img}); taken.fill(1, i, i + w.length); } i = text.indexOf(w, i + 1); }
  }
  const re = /[A-Za-z][A-Za-z']*/g;
  let m;
  while ((m = re.exec(text))) {
    const word = m[0].toLowerCase();
    for (const [stem, img] of latinEntries) {
      const ok = WHOLE.has(stem) ? word === stem || (word.startsWith(stem) && PLURAL.test(word.slice(stem.length)) && word.length - stem.length <= 3) : word.startsWith(stem);
      if (ok) { out.push({a: m.index, b: m.index + m[0].length, img}); break; }
    }
  }
  return out.sort((x, y) => x.a - y.a);
}

// ---- what a word does: a fixed set of gestures a sung word can make on the water (lyric.js) ---------------------
//   shake   trembles           sway    swings on its foot        dip     goes under and comes back
//   grow    swells             spin    turns once on its foot    lean    tips over and stays tipped
//   topple  falls back         beat    beats like a heart        dash    darts along the waterline
//   still   stops moving       flare   burns brighter            echo    rings out again and again
export const GESTURES = ['shake', 'sway', 'dip', 'grow', 'spin', 'lean', 'topple', 'beat', 'dash', 'still', 'flare', 'echo'];
const GLEX = {
  shake: ['trembl', 'shiver', 'shake', 'shaking', 'afraid', 'fear', 'scared', 'nervous', 'quake', 'anxious', '震', '怯', '怖', '抖', '颤', '凍え', '不安'],
  sway: ['dance', 'dancing', 'sway', 'swing', 'float', 'drift', 'waltz', '踊', '舞', '揺れ', '揺ら', '漂', '飘', '摇'],
  dip: ['fall', 'falling', 'fell', 'sink', 'drown', 'deep', 'sleep', 'tired', 'down', 'below', 'under', '落ち', '沈', '溺', '眠', '堕', '坠', '深'],
  grow: ['more', 'forever', 'always', 'everything', 'loud', 'shout', 'scream', 'higher', 'rise', 'grow', 'giant', 'endless', '永遠', 'もっと', '叫', '高く', '强', '強く', '永远', '大きく'],
  spin: ['turn', 'spin', 'round', 'around', 'circle', 'dizzy', 'twist', 'revolv', 'carousel', '回', '巡', '廻', '转', '旋', 'ぐるぐる'],
  lean: ['lost', 'crazy', 'mad', 'wrong', 'lie', 'lying', 'fool', 'mess', 'insane', 'stumbl', '迷', '狂', '嘘', '疯', '错', 'ふらふら'],
  topple: ['break', 'broke', 'broken', 'crash', 'shatter', 'collapse', 'die', 'dead', 'dying', 'kill', 'gone', 'fragile', 'ruin', '壊', '砕', '終わ', '死', '崩', '碎', '破'],
  beat: ['heartbeat', 'beat', 'pulse', 'alive', 'love', 'breath', 'breathing', '鼓動', '愛', '恋', '生き', '脈', '爱', '心跳', '呼吸'],
  dash: ['run', 'running', 'fast', 'away', 'leave', 'escape', 'chase', 'hurry', 'rush', 'flee', '走', '逃', '急', '駆', '追', '跑', '奔'],
  still: ['stop', 'stay', 'wait', 'still', 'frozen', 'freeze', 'silence', 'silent', 'quiet', 'alone', 'pause', '止', '待', '静', '凍', '独り', '停', '等', '黙'],
  flare: ['shine', 'shining', 'burn', 'burning', 'bright', 'flash', 'blaze', 'glow', 'spark', '輝', '燃', '眩', '閃', '亮', '闪', '煌'],
  echo: ['echo', 'again', 'remember', 'repeat', 'memory', 'memories', 'voice', 'name', 'calling', '響', '木霊', '思い出', '呼ぶ', '声', '回忆', '回响', '記憶'],
};
const GWHOLE = new Set(['fear', 'fall', 'fell', 'sink', 'deep', 'down', 'more', 'loud', 'rise', 'grow', 'turn', 'spin', 'round', 'lost', 'mad', 'lie', 'fool', 'mess', 'die', 'dead', 'kill', 'gone', 'beat', 'love', 'run', 'fast', 'away', 'rush', 'flee', 'stop', 'stay', 'wait', 'still', 'burn', 'glow', 'name', 'voice', 'echo', 'again', 'under', 'below', 'swing', 'float', 'drift', 'dance', 'shake', 'pause', 'leave', 'chase', 'break', 'broke', 'crash', 'ruin', 'alive', 'pulse', 'shine', 'flash', 'blaze', 'spark', 'quiet', 'alone', 'wrong', 'crazy']);
const gLatin = [], gCjk = [];
for (const [g, list] of Object.entries(GLEX)) for (const w of list) (CJK_RE.test(w) ? gCjk : gLatin).push([w, g]);
gCjk.sort((a, b) => b[0].length - a[0].length);
// gestures in one line of text: [{a, b, g}] (no overlaps; at most one per word)
export function findGestures(text) {
  const out = [], taken = new Uint8Array(text.length);
  for (const [w, g] of gCjk) {
    let i = text.indexOf(w);
    while (i >= 0) { let free = true; for (let k = i; k < i + w.length; k++) if (taken[k]) free = false; if (free) { out.push({a: i, b: i + w.length, g}); taken.fill(1, i, i + w.length); } i = text.indexOf(w, i + 1); }
  }
  const re = /[A-Za-z][A-Za-z']*/g;
  let m;
  while ((m = re.exec(text))) {
    const word = m[0].toLowerCase();
    for (const [stem, g] of gLatin) {
      const ok = GWHOLE.has(stem) ? word === stem || (word.startsWith(stem) && PLURAL.test(word.slice(stem.length)) && word.length - stem.length <= 3) : word.startsWith(stem);
      if (ok) { out.push({a: m.index, b: m.index + m[0].length, g}); break; }
    }
  }
  return out.sort((x, y) => x.a - y.a);
}

// the whole song: per-line images and the song's motifs (images that recur), from the lexicon
export function localSense(lines) {
  const count = {};
  const perLine = lines.map(L => { const hits = findImages(L.text); for (const h of hits) count[h.img] = (count[h.img] || 0) + 1; return hits; });
  const motifs = Object.entries(count).sort((a, b) => b[1] - a[1]).filter(([, n], i) => n >= 2 || i < 2).slice(0, 4).map(([k]) => k);
  return {source: 'lexicon', perLine, motifs, colors: {}};
}

// the model's reading via the local service (never asked for songs without lyrics); null if there is no key
export async function modelSense(key, lines) {
  if (!lines.length) return null;
  try {
    const r = await fetch('/api/sense', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({key, lines: lines.map(L => L.text)})});
    if (!r.ok) return null;
    const j = await r.json();
    return j && Array.isArray(j.lines) && j.lines.length === lines.length ? j : null;
  } catch { return null; }
}
