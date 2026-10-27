import * as LucideIcons from 'lucide-react';
import type { IconNode, LucideIcon } from 'lucide-react';

// src/utils/lucideIconResolver.ts
// Resolves a theme's lyricsIcons entry (a PascalCase lucide name coming from AI output or the
// theme editor) to a renderable component, so callers never index lucide-react by hand.

// lucide icons are forwardRef objects; requiring that shape keeps the module's other exports
// (createLucideIcon, the icons map, ...) from passing as icon names.
const isLucideIcon = (value: unknown): value is LucideIcon => (
    typeof value === 'object' && value !== null && '$$typeof' in value && 'render' in value
);

export const resolveLucideIcon = (name: string | null | undefined): LucideIcon | null => {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
        return null;
    }

    const candidate = (LucideIcons as unknown as Record<string, unknown>)[trimmed];
    return isLucideIcon(candidate) ? candidate : null;
};

export const isLucideIconName = (name: string) => resolveLucideIcon(name) !== null;

// Case-insensitive name table over the PascalCase exports (same filter Sonnet has always used).
// Built on first use so the other importers of this module never pay for scanning every export.
let lucideIconNamesByLowercase: Map<string, string> | null = null;
const iconNamesByLowercase = () => {
    lucideIconNamesByLowercase ??= new Map(Object.keys(LucideIcons)
        .filter(name => {
            const candidate = LucideIcons[name as keyof typeof LucideIcons];
            return /^[A-Z]/.test(name) && (typeof candidate === 'object' || typeof candidate === 'function');
        })
        .map(name => [name.toLowerCase(), name]));
    return lucideIconNamesByLowercase;
};

/**
 * Resolves a theme's lyricsIcons list to canonical lucide export names: case-insensitive, deduplicated,
 * unknown names dropped. No fallback - callers that want a default icon add it themselves.
 */
export const resolveLucideIconNames = (names: readonly string[] | undefined): string[] => [
    ...new Set((names ?? [])
        .map(name => (typeof name === 'string' ? iconNamesByLowercase().get(name.toLowerCase()) : undefined))
        .filter(Boolean)),
] as string[];

/**
 * Folia loads icons on demand; here every lucide icon is already in the bundle, so this only exists so
 * renderers ported from Folia (hanabi) can `await` it before they build a scene.
 */
export const loadLucideIcons = async (_names: readonly unknown[] | undefined): Promise<void> => undefined;

/**
 * The icon's SVG node data (lucide's IconNode: [tag, attrs, children?][]) for an exact export name, or null
 * when it is unknown. For Pixi renderers that draw the shapes themselves (hanabi's icon stickers).
 * lucide icons are forwardRef objects whose render only builds an element carrying the node data, with no hooks.
 */
export const resolveLucideIconNode = (name: string | null | undefined): IconNode | null => {
    const icon = resolveLucideIcon(name) as unknown as { render?: (props: object, ref: null) => unknown } | null;
    if (!icon || typeof icon.render !== 'function') return null;
    try {
        const element = icon.render({}, null) as { props?: { iconNode?: unknown; icon?: { node?: unknown } } } | null;
        const node = element?.props?.iconNode ?? element?.props?.icon?.node;
        return Array.isArray(node) ? node as IconNode : null;
    } catch {
        return null;
    }
};
