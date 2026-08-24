/** Replace legacy Folia mode / background names with RyanMusic display names. */
const LEGACY_COPY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/商籁/g, '海报'],
  [/镜台/g, '景深'],
  [/云阶/g, '竖阶'],
  [/空\s*\/\s*Sora/gi, '星空'],
  [/空\s*\/\s*星空/g, '星空'],
  [/Sora/g, '星空'],
  [/Folia/g, 'RyanMusic'],
];

export function localizeVisualizerCopy(text: string): string {
  let result = String(text || '');
  for (const [pattern, replacement] of LEGACY_COPY_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
