import { isInterludeDotChar } from '../../../utils/lyrics/parserCore';

export { isInterludeDotChar as isSonnetDotChar };

// Opaque period stand-ins: keep them smaller than CJK punctuation, with a
// visible gap so "..." does not collapse into one scalloped blob.
const SONNET_DOT_RADIUS_EM = 0.075;
const SONNET_DOT_ADVANCE_EM = 0.34;

const ELLIPSIS_DOT_COUNTS: Record<string, number> = {
    '\u2026': 3,
    '\u22EF': 3,
    '\u2025': 2,
};

export const resolveSonnetDotRadius = (fontSize: number) => (
    Math.max(1.4, fontSize * SONNET_DOT_RADIUS_EM)
);

export const resolveSonnetDotAdvance = (fontSize: number) => (
    Math.max(2, fontSize * SONNET_DOT_ADVANCE_EM)
);

export const expandSonnetEllipsisChar = (char: string): string[] => {
    const count = ELLIPSIS_DOT_COUNTS[char];
    if (!count) return [char];
    return Array.from({ length: count }, () => '.');
};

export const expandSonnetEllipsisChars = (chars: string[]): string[] => (
    chars.flatMap(expandSonnetEllipsisChar)
);

export const resolveSonnetGlyphAdvance = (
    char: string,
    fontSize: number,
    measureGlyph: (char: string) => number,
    vertical: boolean,
) => {
    if (isInterludeDotChar(char)) return resolveSonnetDotAdvance(fontSize);
    if (vertical) return fontSize * 0.9;
    return Math.max(fontSize * 0.2, measureGlyph(char));
};
