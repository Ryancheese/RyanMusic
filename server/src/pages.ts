import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function spaHtml(webRoot: string): string | null {
  const manifestPath = [
    join(webRoot, 'static/app/manifest.json'),
    join(webRoot, 'static/app/.vite/manifest.json'),
  ].find((p) => existsSync(p));
  if (!manifestPath) return null;
  let manifest: any;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
  const entry = manifest['index.html'];
  if (!entry?.file) return null;
  const css = Array.isArray(entry.css) ? entry.css : [];
  const cssTags = css
    .map((file: string) => `    <link rel="stylesheet" href="static/app/${file}">`)
    .join('\n');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>RyanMusic - 网易云 · QQ 音乐搜索</title>
    <meta name="renderer" content="webkit">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <link rel="shortcut icon" href="favicon.ico">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
${cssTags}
</head>
<body>
    <div id="root"></div>
    <script type="module" src="static/app/${entry.file}"></script>
</body>
</html>`;
}
