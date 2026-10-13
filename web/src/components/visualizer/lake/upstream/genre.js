// NetEase's own coarse style families (as in the user's playlist 17937401816) → a staging grammar.
// The grammar only biases choices made from measurements and words (composition weights, how the sky is filtered
// and how it moves); it never draws a genre stereotype. See docs/03_曲风动效_GENRE_MODES.md.

// most specific first (a song tagged both 二次元 and 流行 is staged as 二次元)
const ORDER = ['原声带', '二次元', '嘻哈说唱', '爵士', 'R&B', '摇滚', '电子', '另类/独立', '轻音乐', '世界乐器体裁', '流行'];
// library catalogue tags (English) → the same families
const EN = [[/soundtrack|score|ost/, '原声带'], [/anime|video game|game/, '二次元'], [/hip-hop|hip hop|rap/, '嘻哈说唱'], [/jazz|bossa/, '爵士'], [/r&b|soul/, 'R&B'],
  [/rock|metal|punk/, '摇滚'], [/electro|edm|house|techno|synth|dance|trance|dubstep|future bass/, '电子'], [/alternative|indie|dream pop|shoegaze/, '另类/独立'],
  [/ambient|new age|piano|classical|instrumental/, '轻音乐'], [/pop/, '流行']];

export function familyOf(track) {
  const roots = (track.neStyles || []).map(s => String(s).split('-')[0]);
  for (const f of ORDER) if (roots.includes(f)) return f;
  const g = String(track.genre || '').toLowerCase();
  for (const [re, f] of EN) if (re.test(g)) return f;
  return '流行';
}

// layout: multipliers on composition weights; sky: preferred filter and motion; posterK: chorus poster weight
export const GRAMMAR = {
  '原声带': {layout: {steps: 1.2, poster: .8}, filter: 'grade', motion: ['flow', 'drift'], mirror: 1},
  '二次元': {layout: {poster: 1.3, column: 1.2}, filter: 'grade', motion: ['drift'], mirror: 1},
  '嘻哈说唱': {layout: {row: 1.3, steps: 1.2, poster: .8}, filter: 'halftone', motion: ['pulse'], mirror: .7},
  '爵士': {layout: {steps: 1.3, row: 1.1}, filter: 'mono', motion: ['still', 'drift'], mirror: .9},
  'R&B': {layout: {steps: 1.2, row: 1.1}, filter: 'grade', motion: ['flow'], mirror: 1},
  '摇滚': {layout: {poster: 1.5, steps: 1.1}, filter: 'dither', motion: ['pulse', 'flow'], mirror: .6},
  '电子': {layout: {poster: 1.2, steps: 1.2}, filter: 'duotone', motion: ['flow', 'pulse'], mirror: 1},
  '另类/独立': {layout: {row: 1.2, column: 1.2}, filter: 'dither', motion: ['drift'], mirror: .8},
  '轻音乐': {layout: {row: 1.4, column: 1.3, poster: .4}, filter: 'grade', motion: ['still'], mirror: 1},
  '世界乐器体裁': {layout: {row: 1.3}, filter: 'grade', motion: ['still'], mirror: 1},
  '流行': {layout: {}, filter: 'grade', motion: ['drift'], mirror: 1},
};
export const grammarOf = track => GRAMMAR[familyOf(track)] || GRAMMAR['流行'];

// ---- staging modes: six ways a song is staged on the same lake (shots.js reads the numbers) -------------------
// The lake, the waterline, the record and the type are the same in all of them; what differs is the outline of the
// whole performance: how the camera gets from stanza to stanza, how a stanza's lines stand, what the camera does
// while a line is sung, how words arrive.
//   lake    静水  the lake as a place: the camera turns, crosses, steps back, flies over in the long breaths
//   orbit   环轨  everything stands on a circle round the middle; the camera travels round it, always onward
//   strike  切    no travelling: the picture cuts on the beat to the other side or to another part of the lake;
//                 pushes and cranes, words fall out of the sky
//   still   泊    a few seats: lines replace one another or build up where the camera already is; it only breathes,
//                 and moves on in the long breaths
//   screen  屏    stanzas unfold as folding screens; the camera cranes and arcs along them
//   flow    行    the camera walks sideways along the lines, one after another like a wall of text
// Numbers: multipliers on the weights shots.js and score.js would use anyway (1 = unchanged, 0 = never); `ring` and
// `cut` are ways only their mode has. layout: how a line is set (score.js: whole, or word by word); exit: how a
// stanza leaves; lens: its taste for flat views (a long lens from far off) and deep ones (a wide lens from close by);
// planK: how readily a paragraph is laid on the water as a page and read from above. turnK: how far a turn goes; moveK: how much the camera moves in a shot; pace: how long a
// move may take.
export const MODES = {
  lake: {zh: '静水', via: {}, form: {}, kind: {}, enter: {}, exit: {}, layout: {}, lens: {}, planK: .5, turnK: 1, moveK: 1, pace: 1},
  orbit: {zh: '环轨', via: {ring: 3.2, turn: .25, cross: .25, retreat: .5, flap: .7}, form: {screen: 1.4, flap: 1.2, para: .7},
    kind: {orbit: 2.4, arc: 2, spiral: 1.7, pendulum: 1.3, hold: .3, float: .5, track: .6}, enter: {turn: 2, gather: 1.5, rise: .7, fall: .7, surf: 1.4},
    exit: {shut: 1.6, recede: 1.4, fold: .7}, layout: {scatter: 1.6, relay: 1.2}, lens: {flat: .6, deep: 1.5}, planK: .36, turnK: 1, moveK: 1.1, pace: 1},
  strike: {zh: '切', via: {cut: 3.4, turn: .5, cross: .5, retreat: .7, flap: 1.3, over: .5}, form: {flap: 2, para: 1, screen: .8},
    kind: {pushIn: 2.4, pullBack: 1.6, crane: 1.5, hold: 1.2, swell: 1.2, orbit: .5, float: .2, glide: .6}, enter: {fall: 2.4, rise: .8, turn: .6, gather: .5, type: 2.2, sprout: 1.5, surf: .6},
    exit: {melt: 2, shut: 1.5, lift: 1.5, sink: .7, recede: .5}, layout: {single: 2.2, poster: 1.3, relay: .8}, lens: {flat: 1.2, mid: .3, deep: 1.3}, planK: .36, turnK: 1.15, moveK: 1.25, pace: .85},
  still: {zh: '泊', via: {flap: 2.4, retreat: 1.8, turn: .3, cross: .25}, form: {para: 2, flap: 1.5, screen: .6},
    kind: {hold: 2.6, float: 2.6, glide: 1.7, swell: 1.3, orbit: .3, flyby: 0, track: .4, pendulum: .4, spiral: .4}, enter: {rise: 1.8, gather: 1.6, turn: .6, fall: .4, surf: 1.5, type: .3, slide: .6},
    exit: {sink: 1.6, recede: 1.7, blow: .5, melt: .7}, layout: {relay: 1.5, single: .6, column: 1.2}, lens: {flat: 1.8, deep: .5}, planK: .7, turnK: .7, moveK: .6, pace: 1.25},
  screen: {zh: '屏', via: {turn: 1.5, cross: 1.2, retreat: .6, flap: .6}, form: {screen: 2.6, para: .8, flap: .6},
    kind: {crane: 2, arc: 1.7, pullBack: 1.4, glide: 1.2, flyby: .4}, enter: {turn: 1.8, fall: 1.2, rise: 1, gather: .7, sprout: 1.3},
    exit: {fold: 1.6, shut: 1.5}, layout: {scatter: 1.3, column: 1.3}, lens: {flat: 1.3}, planK: .5, turnK: 1.1, moveK: 1, pace: 1},
  flow: {zh: '行', via: {cross: 2.6, flap: 1.6, turn: .6, retreat: .6}, form: {flap: 2, screen: 1.1, para: .7},
    kind: {track: 2.6, flyby: 1.9, pendulum: 1.3, glide: 1.1, hold: .4, float: .4, orbit: .6}, enter: {rise: 1.2, turn: 1.2, gather: .8, fall: .8, slide: 1.9, type: 1.7},
    exit: {blow: 1.9, part: 1.4, sink: .7}, layout: {single: 1.6, relay: 1.6, steps: 1.2}, lens: {flat: 1.1}, planK: .42, turnK: .9, moveK: 1.15, pace: .9},
};
const FAMILY_MODE = {'原声带': 'still', '二次元': 'screen', '嘻哈说唱': 'flow', '爵士': 'still', 'R&B': 'lake', '摇滚': 'strike', '电子': 'orbit', '另类/独立': 'lake', '轻音乐': 'still', '世界乐器体裁': 'still', '流行': 'lake'};
/** the mode a song is staged in: from its style family, corrected by how the song itself behaves (signal.js character) */
export function modeOf(track, ch = {}, force) {
  if (force && MODES[force]) return force;
  const fam = familyOf(track);
  let m = FAMILY_MODE[fam] || 'lake';
  // what the song does outweighs what it is called
  if ((m === 'lake' || m === 'screen') && ch.punch > .72 && ch.busy > .55) m = 'strike';
  else if (m === 'lake' && ch.punch < .3 && ch.busy < .35) m = 'still';
  else if (m === 'strike' && ch.punch < .35) m = 'lake';
  else if (m === 'lake' && fam === '另类/独立' && ch.wide > .8 && ch.busy > .5) m = 'orbit';
  return m;
}

// ---- styles: how a family looks on the same lake (lyric.js, score.js, shots.js, stage.js read it) ----------------
// One table drives the type (a face pair per line type: waiting → sung; Latin and CJK apart), how words arrive and
// leave, how sung words flash and glow, the colour treatment, and the finish over the whole picture. Faces are lyric.js
// names: serif, serifI, hair, black, thin, light, wide, mono (Latin); jp4, jp6, jp9, sans, sans6 (CJK). '~' after a
// face: in outline. Types: whisper (tender, calm), wire (bright, most), outline (tense, dark), mass (a loud chorus).
//   rock     compressed black capitals throughout, hard arrivals (fall, drop, typed), hard exits (shut, melt); white
//            hot flashes, high contrast; grain, a little fringe, a heavy vignette (the dither sky filter is grammar's)
//   pop      serif and italic mixed, soft swells; a cleaner, brighter finish with more bloom
//   electro  wide or monospaced capitals, scanned in (type, slide, surf); duotone colour; sharp, cold
//   hiphop   heavy capitals stamped word by word (pop, drop, type); monospace whispers; halftone sky; punchy flash
//   anime    the serif and Japanese serif at full weight on the hero; posters and columns (grammar); light beams
//   soft     italic serif only, slow and quiet (rise, gather; sink, recede); ink colour, little flash, soft finish
//   (emph: 'motes' — pop and soft: a sung hero or image word is not struck with a star of light; it swells softly
//   and sheds motes of light that drift up off it and fade, 2026-10-07)
//   indie    hairline capitals waiting, serif sung; washed colour, heavier grain
export const STYLES = {
  rock: {zh: '摇滚', latin: {whisper: ['hair', 'black'], wire: ['hair', 'black'], outline: ['black~', 'black'], mass: ['hair', 'black']}, cjk: {wait: 'jp4', sung: 'jp9', hero: 'jp9'},
    enter: {fall: 1.8, drop: 1.6, type: 1.5, slide: 1.3, turn: .6, gather: .5, sprout: .7}, exit: {shut: 1.6, melt: 1.4, blow: 1.2, sink: .6, recede: .7},
    flash: .75, pop: 1.3, glow: .95, tone: 'stark', emph: 'motes', flashEnv: [.03, .2], motes: {rise: 1.6, side: .8, life: .8, size: .8, n: 1, shape: 0, warm: .35}, post: {grain: .03, ab: .0024, vig: .44, bloom: .34}},
  pop: {zh: '流行', latin: {whisper: ['serifI', 'serifI'], wire: ['serifI', 'serif'], outline: ['serif~', 'serifI'], mass: ['light', 'black']}, cjk: {wait: 'jp4', sung: 'jp6', hero: 'jp9'},
    enter: {rise: 1.3, gather: 1.3, sprout: 1.2, turn: 1.1, fall: .7, type: .5}, exit: {lift: 1.3, part: 1.2, melt: 1.1, shut: .7},
    flash: .45, pop: 1.1, glow: .78, tone: 'bloom', emph: 'motes', flashEnv: [.1, .55], motes: {}, post: {grain: .012, ab: .001, vig: .28, bloom: .27}},
  electro: {zh: '电子', latin: {whisper: ['mono', 'light'], wire: ['mono', 'wide'], outline: ['thin~', 'wide'], mass: ['thin', 'wide']}, cjk: {wait: 'sans', sung: 'sans', hero: 'sans6'},
    enter: {type: 2, slide: 1.6, surf: 1.5, turn: 1.2, rise: .6, fall: .6, gather: .6}, exit: {shut: 1.4, recede: 1.4, melt: 1.2, blow: .5, sink: .7},
    flash: .6, pop: .8, glow: .95, tone: 'duo', emph: 'motes', flashEnv: [.04, .26], motes: {rise: .7, side: 1.4, life: .9, size: .8, n: 1, shape: 1, quant: 1}, post: {grain: .008, ab: .0034, vig: .34, bloom: .36}},
  hiphop: {zh: '嘻哈', latin: {whisper: ['mono', 'black'], wire: ['hair', 'black'], outline: ['black~', 'black'], mass: ['hair', 'black']}, cjk: {wait: 'sans', sung: 'sans6', hero: 'sans6'},
    enter: {pop: 2, drop: 1.8, type: 1.6, fall: 1.2, slide: 1.1, rise: .6, turn: .5, gather: .4}, exit: {shut: 1.4, part: 1.3, blow: 1.2, sink: .7},
    flash: .7, pop: 1.6, glow: .85, tone: 'stark', emph: 'motes', flashEnv: [.03, .22], motes: {rise: .5, side: 1.6, life: 1.2, size: .7, n: 1.3, shape: 0}, post: {grain: .026, ab: .0016, vig: .4, bloom: .3}},
  anime: {zh: '二次元', latin: {whisper: ['hair', 'serif'], wire: ['serifI', 'serif'], outline: ['serif~', 'serif'], mass: ['hair', 'black']}, cjk: {wait: 'jp4', sung: 'jp6', hero: 'jp9'},
    enter: {rise: 1.2, turn: 1.3, fall: 1.2, sprout: 1.2, gather: 1}, exit: {lift: 1.4, part: 1.2, recede: 1.1},
    flash: .5, pop: 1, glow: .8, tone: 'bloom', emph: 'motes', flashEnv: [.08, .5], motes: {rise: .8, side: 1, life: 1.3, size: 1.3, n: .9, shape: 0}, post: {grain: .014, ab: .0012, vig: .3, bloom: .32}},
  soft: {zh: '轻柔', latin: {whisper: ['serifI', 'serifI'], wire: ['serifI', 'serifI'], outline: ['serifI~', 'serifI'], mass: ['serifI', 'serif']}, cjk: {wait: 'jp4', sung: 'jp4', hero: 'jp6'},
    enter: {rise: 1.6, gather: 1.5, surf: 1.2, fall: .3, type: .2, drop: .3, slide: .7}, exit: {sink: 1.6, recede: 1.6, melt: .5, shut: .4, blow: .6},
    flash: .45, pop: .6, glow: .8, tone: 'ink', emph: 'motes', flashEnv: [.12, .6], motes: {rise: .7, life: 1.4, size: 1.1, n: .8}, post: {grain: .016, ab: .0008, vig: .3, bloom: .26}},
  indie: {zh: '独立', latin: {whisper: ['hair', 'serifI'], wire: ['hair', 'serif'], outline: ['serif~', 'serif'], mass: ['hair', 'light']}, cjk: {wait: 'sans', sung: 'jp4', hero: 'jp6'},
    enter: {rise: 1.2, surf: 1.4, drift: 1.2, gather: 1.1, fall: .6}, exit: {recede: 1.4, blow: 1.3, sink: 1.1, shut: .6},
    flash: .5, pop: .85, glow: .85, tone: 'wash', emph: 'motes', flashEnv: [.06, .4], motes: {rise: .4, side: .8, life: 1.1, size: .7, n: .6, flicker: 1}, post: {grain: .03, ab: .0014, vig: .36, bloom: .3}},
};
// ---- looks: what each style has that the others do not (2026-10-07: the user found rock and pop sharing too much) --
// aurora, reeds (the spectral lines: brightness, height, quantised into steps, drained to white), motes, chrome (the
// sheet's and boards' marks and slugs), and the style's own elements (stage.js POST, sky.js):
//   rock     white shafts of light strike up the sky on the hard low beats; hard contrast, drained colour; on the
//            hardest downbeats of a loud passage a one-bit impact frame. No aurora, no motes, almost no chrome
//   pop      soft out-of-focus discs of the song's colours drift over the picture; brighter colour; the aurora
//   electro  a lit grid on the water with a pulse running out over it on the beat; scanlines; the spectrum in LED
//            steps; the full instrument chrome. No aurora
//   hiphop   halftone dots in the dark of the picture; chunky stepped bars; harder contrast
//   anime    beams of light fanning down from the record's place in the sky; a soft pool of light opens behind a sung
//            hero word (it was speed lines until 2026-10-07: the user wants no splash, only soft light)
//   soft     a low mist on the water; faint lines; washed colour; no chrome
//   indie    warm light leaks drifting in at the frame's edges; faded colour
const LOOKS = {
  rock: {aurora: 0, reeds: {k: 1.25, h: 1.5, quant: 0, white: .85, layout: 'rays'}, motes: 0, chrome: .2, shafts: 1, contrast: 1.32, sat: .5, impact: .45},
  pop: {aurora: 1.25, reeds: {k: .55, h: .8, quant: 0, white: 0, layout: 'sunflower'}, motes: 1.4, chrome: 0, bokeh: 1, contrast: .96, sat: 1.18},
  electro: {aurora: 0, reeds: {k: 1.15, h: 1.15, quant: 7, white: 0, layout: 'grid'}, motes: .4, chrome: 1, grid: 1, scan: 1, contrast: 1.1, sat: 1.1},
  hiphop: {aurora: 0, reeds: {k: .9, h: 1.05, quant: 4, white: .3, layout: 'grooves'}, motes: .3, chrome: .5, halftone: 1, contrast: 1.2, sat: .82},
  anime: {aurora: .9, reeds: {k: .8, h: 1, quant: 0, white: 0, layout: 'sunflower'}, motes: 1, chrome: .55, beams: 1, pool: 1, contrast: 1.04, sat: 1.06},
  soft: {aurora: .7, reeds: {k: .32, h: .7, quant: 0, white: 0, layout: 'sunflower'}, motes: .6, chrome: 0, mist: 1, contrast: .9, sat: .72},
  indie: {aurora: .25, reeds: {k: .6, h: .9, quant: 0, white: .2, layout: 'drift'}, motes: .5, chrome: .4, leak: 1, contrast: .97, sat: .74},
};
const FAMILY_STYLE = {'原声带': 'anime', '二次元': 'anime', '嘻哈说唱': 'hiphop', '爵士': 'soft', 'R&B': 'soft', '摇滚': 'rock', '电子': 'electro', '另类/独立': 'indie', '轻音乐': 'soft', '世界乐器体裁': 'soft', '流行': 'pop'};
const FORCE_STYLE = new URLSearchParams(globalThis.location?.search || '').get('style');   // (?style=rock: look at a song in another family's style)
/** the style a song is shown in, with its name */
export function styleOf(track) {
  const picked = track && STYLES[track.forceStyle] ? track.forceStyle : null;
  const name = picked || (STYLES[FORCE_STYLE] ? FORCE_STYLE : FAMILY_STYLE[familyOf(track)] || 'pop');
  return {name, ...STYLES[name], look: LOOKS[name]};
}
