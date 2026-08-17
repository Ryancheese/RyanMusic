import { detectLyricParseFormat, findLatestActiveLineIndex, trackToVisualizerLines } from '../src/lib/lyrics.ts';

const yrc = `[1080,1860](1080,420,0)你(1500,440,0)好(1940,1000,0)吗`;
const lines = trackToVisualizerLines({
  lrc: '[00:01.00]fallback',
  yrc,
  tlyric: '[00:01.08]hello',
});

if (!lines.length) {
  throw new Error('YRC should produce lyric lines');
}

const first = lines[0];
if (first.words.length < 3) {
  throw new Error('YRC should keep word-level timings, got ' + first.words.length);
}

if (Math.abs(first.words[0].startTime - 1.08) > 0.001) {
  throw new Error('First YRC word should start at 1.08s, got ' + first.words[0].startTime);
}

if (first.translation !== 'hello') {
  throw new Error('YRC translation should attach, got ' + String(first.translation));
}

if (detectLyricParseFormat(yrc) !== 'yrc') {
  throw new Error('YRC content should be detected as yrc');
}

const lrcLines = trackToVisualizerLines({
  lrc: '[00:01.00]春风[00:01.40]十里\n[00:04.00]下一句',
});
if (detectLyricParseFormat('[00:01.00]春风[00:01.40]十里') !== 'enhanced-lrc') {
  throw new Error('Inline bracket LRC should be detected as enhanced-lrc');
}
if (lrcLines[0].words.length < 2) {
  throw new Error('Enhanced LRC should keep per-word timestamps');
}

if (findLatestActiveLineIndex(lines, 1.2) !== 0) {
  throw new Error('Active line lookup should follow Folia render window');
}

console.log('lyric parser tests passed');
