/** Folia `electron/spotify/errors.cjs` 同款错误形状。 */

const CODES = new Set([
  'auth-required',
  'unsupported',
  'unavailable',
  'not-playable',
  'preview-only',
  'subscription-required',
  'region-restricted',
  'network',
  'invalid-response',
]);

export class SpotifyError extends Error {
  code: string;
  detail?: string;
  reason?: string;

  constructor(code: string, message: string, detail?: string, reason?: string) {
    super(message);
    this.name = 'SpotifyError';
    this.code = code;
    if (detail) this.detail = detail;
    if (reason) this.reason = reason;
  }
}

export function spotifyError(code: string, message: string, detail?: string, reason?: string) {
  return new SpotifyError(code, message, detail, reason);
}

const ASKED_TO_WAIT = 'Spotify asked to wait before trying again';

export function statusError(status: number, code: string, message: string, detail?: string) {
  if (status === 429) return spotifyError('network', ASKED_TO_WAIT, detail);
  return spotifyError(status >= 500 ? 'network' : code, message, detail);
}

export function toErrorResult(error: any) {
  if (error instanceof SpotifyError && CODES.has(error.code)) {
    return {
      ok: false as const,
      error: {
        code: error.code,
        message: error.message,
        ...(error.reason ? { reason: error.reason } : {}),
      },
    };
  }
  const text = `${error?.name ?? ''} ${error?.message ?? ''}`;
  if (/fetch failed|net::|ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network|socket|TimeoutError|AbortError/i.test(text)) {
    return { ok: false as const, error: { code: 'network', message: 'Spotify could not be reached' } };
  }
  return { ok: false as const, error: { code: 'invalid-response', message: 'Spotify operation failed' } };
}

export function lineReason(error: any): string | undefined {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'no-answer';
  const { code, message } = toErrorResult(error).error;
  if (code !== 'network') return undefined;
  return message === ASKED_TO_WAIT ? 'asked-to-wait' : 'unreachable';
}

export function plainWords(text: unknown) {
  return String(text)
    .replace(/https?:\\*\/\\*\/\S+/gi, '<address>')
    .replace(/[\w.~+/=%-]{32,}/g, '<long>')
    .slice(0, 160);
}

export function describeError(error: any) {
  return `${toErrorResult(error).error.code} (${plainWords(error?.detail ?? error?.message ?? error)})`;
}
