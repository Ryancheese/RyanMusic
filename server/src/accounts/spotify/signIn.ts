import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto';
import http from 'node:http';
import { describeError, lineReason, spotifyError, statusError } from './errors.ts';

/** Folia `electron/spotify/signIn.cjs`：浏览器 PKCE + 本机回环回调。 */

export const CLIENT_ID = '65b708073fc0480ea92a077233ca87bd';
export const PORT = 5588;
export const REDIRECT_URI = `http://127.0.0.1:${PORT}/login`;
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const ATTEMPT_MS = 10 * 60 * 1000;
const REQUEST_LIMIT_MS = 30 * 1000;

const SCOPES = [
  'app-remote-control', 'playlist-modify', 'playlist-modify-private', 'playlist-modify-public', 'playlist-read',
  'playlist-read-collaborative', 'playlist-read-private', 'streaming', 'ugc-image-upload', 'user-follow-modify',
  'user-follow-read', 'user-library-modify', 'user-library-read', 'user-modify', 'user-modify-playback-state',
  'user-modify-private', 'user-personalized', 'user-read-birthdate', 'user-read-currently-playing', 'user-read-email',
  'user-read-play-history', 'user-read-playback-position', 'user-read-playback-state', 'user-read-private',
  'user-read-recently-played', 'user-top-read',
].join(' ');

const PAGE_TEXT = Object.freeze({
  'zh-CN': {
    done: '已登录 Spotify，可以回到 RyanMusic 了。',
    refused: '未授权。请回到 RyanMusic 重试。',
    failed: '登录未完成。请回到 RyanMusic 重试。',
  },
  en: {
    done: 'Signed in to Spotify. You can go back to RyanMusic.',
    refused: 'Not authorized. Try again in RyanMusic.',
    failed: 'Sign-in not completed. Try again in RyanMusic.',
  },
});

const pageOf = (text: string) =>
  `<!doctype html><meta charset="utf-8"><title>RyanMusic</title><body style="margin:0;display:grid;place-items:center;height:100vh;background:#121212;color:#fff;font:16px system-ui,sans-serif">${text}</body>`;

const PAGE_HEADERS = Object.freeze({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  Connection: 'close',
});

const RETURN_REASONS = Object.freeze({
  access_denied: 'access-denied',
  server_error: 'unreachable',
  temporarily_unavailable: 'asked-to-wait',
}) as Record<string, string>;

const base64url = (buffer: Buffer) =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface Attempt {
  key: string;
  verifier: string;
  state: string;
  page: string;
  server: http.Server;
  expiresAt: number;
  outcome: { tokens?: SpotifyTokens; error?: string } | null;
  settling: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export function createSpotifySignIn({
  fetch: fetchFn = globalThis.fetch,
  openExternal,
  language = () => 'zh-CN',
  now = Date.now,
  createServer = () => http.createServer(),
  randomBytes = (size: number) => nodeRandomBytes(size),
  log = (...args: unknown[]) => console.log(...args),
  warn = (...args: unknown[]) => console.warn(...args),
}: {
  fetch?: typeof globalThis.fetch;
  openExternal: (url: string) => Promise<void>;
  language?: () => string;
  now?: () => number;
  createServer?: () => http.Server;
  randomBytes?: (size: number) => Buffer;
  log?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}) {
  let pending: Attempt | null = null;

  const tokens = async (fields: Record<string, string>, kept?: string): Promise<SpotifyTokens> => {
    const response = await fetchFn(TOKEN_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(REQUEST_LIMIT_MS),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: CLIENT_ID, ...fields }).toString(),
    });
    const body = await response.json().catch(() => null) as any;
    if (body?.error === 'invalid_grant') {
      throw spotifyError('auth-required', 'Spotify no longer accepts the sign-in', 'invalid_grant');
    }
    const refreshToken = body?.refresh_token ?? kept;
    if (!response.ok || typeof body?.access_token !== 'string' || typeof refreshToken !== 'string') {
      throw statusError(response.status, 'invalid-response', 'Spotify did not issue a token', `HTTP ${response.status} ${body?.error ?? ''}`);
    }
    return {
      access_token: body.access_token,
      refresh_token: refreshToken,
      expires_at: now() + Math.max(60, Number(body.expires_in) || 3600) * 1000,
    };
  };

  const stopListening = (attempt: Attempt) => {
    if (attempt.timer) clearTimeout(attempt.timer);
    attempt.server.close();
    (attempt.server as any).closeAllConnections?.();
  };

  const drop = () => {
    if (pending) stopListening(pending);
    pending = null;
  };

  const answer = (attempt: Attempt, request: http.IncomingMessage, response: http.ServerResponse) => {
    let url: URL | null = null;
    try {
      url = new URL(request.url || '', REDIRECT_URI);
    } catch {
      /* answered below */
    }
    if (!url || request.method !== 'GET' || url.pathname !== '/login') {
      response.writeHead(404).end();
      return;
    }
    const text = (PAGE_TEXT as any)[language()] ?? PAGE_TEXT.en;
    if (url.searchParams.get('state') !== attempt.state) {
      response.writeHead(200, PAGE_HEADERS).end(pageOf(text.failed));
      return;
    }
    if (attempt.settling) {
      response.writeHead(404).end();
      return;
    }
    attempt.settling = true;
    const leave = (words: string, outcome: Attempt['outcome']) => {
      attempt.outcome = outcome;
      response.writeHead(200, PAGE_HEADERS);
      response.end(pageOf(words), () => stopListening(attempt));
    };
    const code = url.searchParams.get('code');
    if (!code) {
      const said = url.searchParams.get('error');
      const reason = Object.hasOwn(RETURN_REASONS, said ?? '')
        ? RETURN_REASONS[said!]
        : said
          ? 'refused'
          : 'sign-in-failed';
      warn(`[Spotify] Sign-in was not completed: ${reason}`);
      leave(reason === 'access-denied' ? text.refused : text.failed, { error: reason });
      return;
    }
    tokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: attempt.verifier,
    }).then(
      (issued) => leave(text.done, { tokens: issued }),
      (error) => {
        warn(`[Spotify] The code Spotify sent back was not exchanged: ${describeError(error)}`);
        leave(text.failed, {
          error: lineReason(error) ?? (error?.code === 'auth-required' ? 'refused' : 'sign-in-failed'),
        });
      },
    );
  };

  return {
    async start() {
      drop();
      const verifier = base64url(randomBytes(64));
      const attempt: Attempt = {
        key: randomBytes(16).toString('hex'),
        verifier,
        state: base64url(randomBytes(16)),
        page: '',
        server: createServer(),
        expiresAt: now() + ATTEMPT_MS,
        outcome: null,
        settling: false,
        timer: null,
      };
      attempt.page = `${AUTHORIZE_URL}?${new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        code_challenge_method: 'S256',
        code_challenge: base64url(createHash('sha256').update(verifier).digest()),
        state: attempt.state,
      })}`;
      attempt.server.on('request', (request, response) => answer(attempt, request, response));
      await new Promise<void>((resolve, reject) => {
        attempt.server.once('error', (error: any) =>
          reject(spotifyError('unavailable', 'Spotify sign-in could not listen for the answer', error?.code, 'cannot-listen')));
        attempt.server.listen(PORT, '127.0.0.1', () => resolve());
      });
      attempt.timer = setTimeout(() => stopListening(attempt), ATTEMPT_MS);
      attempt.timer.unref?.();
      pending = attempt;
      log(`[Spotify] Sign-in is waiting on 127.0.0.1:${PORT} for ${ATTEMPT_MS / 60000} min`);
      return { key: attempt.key, expiresInMs: ATTEMPT_MS };
    },

    async open(key: string) {
      if (pending?.key !== key || pending.outcome) return false;
      await openExternal(pending.page);
      return true;
    },

    check(key: string) {
      if (pending?.key !== key) return { state: 'expired' as const };
      if (pending.outcome?.tokens) return { state: 'approved' as const, tokens: pending.outcome.tokens };
      if (pending.outcome) {
        const message = pending.outcome.error;
        drop();
        return { state: 'error' as const, message };
      }
      if (now() >= pending.expiresAt) {
        drop();
        return { state: 'expired' as const };
      }
      return { state: 'waiting' as const };
    },

    holds: (key: string) => pending?.key === key,
    finish(key: string) {
      if (pending?.key === key) drop();
    },
    cancel() {
      drop();
    },
    renew: (refreshToken: string) => tokens({ grant_type: 'refresh_token', refresh_token: refreshToken }, refreshToken),
  };
}
