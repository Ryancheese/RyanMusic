import { defineConfig, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const apiOrigin = process.env.VITE_API_ORIGIN || process.env.VITE_PHP_ORIGIN || 'http://127.0.0.1:8088';

const DOC_REDIRECTS: Record<string, string> = {
  '/help.php': '/?doc=help',
  '/help': '/?doc=help',
  '/disclaimer.php': '/?doc=disclaimer',
  '/disclaimer': '/?doc=disclaimer',
  '/privacy.php': '/?doc=privacy',
  '/privacy': '/?doc=privacy',
};

function copyManifestPlugin() {
  return {
    name: 'ryanmusic-copy-manifest',
    apply: 'build' as const,
    closeBundle() {
      const from = path.resolve(rootDir, '../web-root/static/app/.vite/manifest.json');
      const to = path.resolve(rootDir, '../web-root/static/app/manifest.json');
      if (fs.existsSync(from)) {
        fs.copyFileSync(from, to);
      }
    },
  };
}

function proxyApiPlugin() {
  return {
    name: 'ryanmusic-api-proxy',
    apply: 'serve' as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '/';
        const pathname = url.split('?')[0];
        const docTarget = DOC_REDIRECTS[pathname];
        if (docTarget) {
          res.writeHead(302, { Location: docTarget });
          res.end();
          return;
        }
        const shouldProxy =
          pathname === '/api.php' ||
          (req.method === 'POST' && (pathname === '/' || pathname === '/index.php')) ||
          (req.method === 'GET' && (url.includes('cover=') || url.includes('download=') || url.includes('img=')));

        if (!shouldProxy) {
          next();
          return;
        }

        const target = new URL(apiOrigin);
        const proxyReq = http.request(
          {
            hostname: target.hostname,
            port: target.port || 80,
            path: url,
            method: req.method,
            headers: {
              ...req.headers,
              host: target.host,
            },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
            proxyRes.pipe(res);
          },
        );
        proxyReq.on('error', () => {
          res.statusCode = 502;
          res.end('API backend unavailable. Start Node on ' + apiOrigin);
        });
        req.pipe(proxyReq);
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), proxyApiPlugin(), copyManifestPlugin()],
  base: command === 'build' ? '/static/app/' : '/',
  build: {
    outDir: path.resolve(rootDir, '../web-root/static/app'),
    emptyOutDir: true,
    manifest: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
}));
