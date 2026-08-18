import type { Track } from './config.ts';

const AUTO_MATCH_MIN_SCORE = 72;
const AUTO_MATCH_SEARCH_LIMIT = 8;

function normalizeMatchText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\(\[（【].*?[\)\]）】]/g, '')
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .trim();
}

function stringSimilarity(a: string, b: string): number {
  const n1 = normalizeMatchText(a);
  const n2 = normalizeMatchText(b);
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1;
  if (n1.includes(n2) || n2.includes(n1)) {
    return Math.min(n1.length, n2.length) / Math.max(n1.length, n2.length);
  }
  const set1 = new Set(n1);
  const set2 = new Set(n2);
  let intersection = 0;
  for (const ch of set1) if (set2.has(ch)) intersection += 1;
  const union = new Set([...set1, ...set2]).size;
  return union > 0 ? intersection / union : 0;
}

function artistSimilarity(target: string, search: string): number {
  const split = (value: string) => value
    .split(/[,&、/]|feat\.?|ft\.?|featuring|与/i)
    .map((part) => normalizeMatchText(part))
    .filter(Boolean);
  const left = split(target);
  const right = split(search);
  if (!left.length || !right.length) return stringSimilarity(target, search);
  let hits = 0;
  for (const a of left) {
    if (right.some((b) => a === b || (a.length >= 2 && b.includes(a)) || (b.length >= 2 && a.includes(b)))) {
      hits += 1;
    }
  }
  return Math.max(hits / Math.max(left.length, right.length), stringSimilarity(target, search));
}

export function pickBestCrossPlayTrack(
  target: { title: string; artist: string },
  tracks: Track[],
): Track | null {
  const scored = tracks
    .slice(0, AUTO_MATCH_SEARCH_LIMIT)
    .map((track) => {
      const titleSim = stringSimilarity(target.title, track.title);
      const artistSim = target.artist.trim()
        ? artistSimilarity(target.artist, track.author)
        : 1;
      let identity = titleSim * 50 + artistSim * 30 + 20;
      const titleMatched = titleSim >= 0.62;
      const artistMatched = !target.artist.trim() || artistSim >= 0.45;
      if (!titleMatched || !artistMatched) identity = Math.min(identity, 70);
      return {
        track,
        score: Math.round(identity),
        titleMatched,
        artistMatched,
      };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored.find((item) => item.titleMatched && item.artistMatched) ?? scored[0];
  if (!best) return null;
  if (!best.titleMatched) return null;
  if (best.score < AUTO_MATCH_MIN_SCORE) return null;
  return best.track;
}
