import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSION } from './config.ts';

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

function stripPhp(content: string): string {
  return content.replace(/^<\?php[\s\S]*?\?>\s*/m, '');
}

export function docPage(webRoot: string, kind: 'help' | 'disclaimer'): string {
  const file = kind === 'help' ? 'help-content.php' : 'disclaimer-content.php';
  const path = join(webRoot, 'template', file);
  const body = existsSync(path) ? stripPhp(readFileSync(path, 'utf8')) : '<p>文档缺失。</p>';
  const title = kind === 'help' ? '使用帮助' : '免责声明';
  const other = kind === 'help' ? 'disclaimer.php' : 'help.php';
  const otherLabel = kind === 'help' ? '免责声明' : '使用帮助';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>${title} - RyanMusic</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="shortcut icon" href="favicon.ico">
    <link rel="stylesheet" href="static/vendor/amazeui/amazeui.min.css">
    <link rel="stylesheet" href="static/css/style.css?v=${VERSION}">
</head>
<body class="theme-apple-glass help-page">
    <section class="about help-page__wrap">
        <div class="am-container">
            <a href="./" class="help-page__back">← 返回搜索</a>
            <article class="music-tips glass-panel help-page__panel">
                <h1 class="help-page__title">${title}</h1>
                <div class="help-page__body">${body}</div>
            </article>
        </div>
    </section>
    <footer class="footer">
        <p class="am-text-sm">v${VERSION} &copy; ${new Date().getFullYear()} <a href="./">RyanMusic</a> · <a href="${other}">${otherLabel}</a></p>
    </footer>
</body>
</html>`;
}
