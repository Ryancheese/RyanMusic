import { detectLyricParseFormat, findLatestActiveLineIndex, resolveVisualizerLyrics, trackToVisualizerLines } from '../src/lib/lyrics.ts';

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
if (findLatestActiveLineIndex(lines, 4) !== 0) {
  throw new Error('Active line should hold until the next line starts, got ' + findLatestActiveLineIndex(lines, 4));
}

const sparseResolved = resolveVisualizerLyrics({
  lrc: '[00:10.00]第一行\n[00:20.00]第二行\n[00:30.00]第三行\n[00:40.00]第四行',
  yrc: `[10000,2000](10000,200,0)第一(10200,200,0)行`,
});
if (sparseResolved.lines.length < 3) {
  throw new Error('Incomplete yrc should fall back to fuller lrc');
}

const relativeYrc = `[1080,1860](0,420,0)你(420,440,0)好(860,1000,0)吗`;
const relativeYrcLines = trackToVisualizerLines({ yrc: relativeYrc });
if (Math.abs((relativeYrcLines[0]?.words[0]?.startTime || 0) - 1.08) > 0.001) {
  throw new Error('Relative YRC word time should add line start, got ' + relativeYrcLines[0]?.words[0]?.startTime);
}

const mashedYrc = `[10000,5000](10000,200,0)月(10200,200,0)光(10400,200,0)色(10600,200,0)香(11800,200,0)泪(12000,200,0)断(12200,200,0)剑`;
const mashedLines = trackToVisualizerLines({ yrc: mashedYrc }).filter((line) => line.fullText && line.fullText !== '......');
if (mashedLines.length < 2) {
  throw new Error('YRC phrase gap should split mashed lines, got ' + mashedLines.map((line) => line.fullText).join('|'));
}

const qrc = `[0,800]你(0,200)好(200,200)吗(400,200)`;
if (detectLyricParseFormat(qrc) !== 'qrc') {
  throw new Error('QRC content should be detected as qrc, got ' + detectLyricParseFormat(qrc));
}
const qrcLines = trackToVisualizerLines({ lrc: '[00:00.00]fallback', yrc: qrc });
if (qrcLines[0]?.words.length < 3) {
  throw new Error('QRC in yrc field should keep word-level timings');
}

const headedQrc = `[ti:晴天]\n[ar:周杰伦]\n[offset:0]\n[10510,800]故事(10510,200)的(10710,200)小黄花(10910,400)`;
if (detectLyricParseFormat(headedQrc) !== 'qrc') {
  throw new Error('QRC with metadata header should still be detected as qrc, got ' + detectLyricParseFormat(headedQrc));
}
const headedLines = trackToVisualizerLines({ lrc: '[00:10.51]fallback', yrc: headedQrc });
const headedMain = headedLines.find((line) => line.fullText.includes('故事'));
if (Math.abs((headedMain?.words[0]?.startTime || 0) - 10.51) > 0.001) {
  throw new Error('Absolute QRC word time should stay absolute, got ' + headedMain?.words[0]?.startTime);
}

const relativeQrc = `[10510,800]你(0,200)好(200,200)吗(400,200)`;
const relativeLines = trackToVisualizerLines({ yrc: relativeQrc });
const relativeMain = relativeLines.find((line) => line.fullText.includes('你'));
if (Math.abs((relativeMain?.words[0]?.startTime || 0) - 10.51) > 0.001) {
  throw new Error('Relative QRC word time should add line start, got ' + relativeMain?.words[0]?.startTime);
}

console.log('lyric parser tests passed');
