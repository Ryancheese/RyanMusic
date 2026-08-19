import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = join(root, 'node_modules');
const esbuildVersion = '0.25.5';
const platformPkg = '@esbuild/win32-x64';

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed ${url}: ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${url}: ${res.status}`);
  return res.json();
}

async function extractTarGz(tgzPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  execFileSync('C:\\Windows\\System32\\tar.exe', ['-xzf', tgzPath, '-C', destDir], { stdio: 'inherit' });
}

async function installPackage(name, version, destName = name) {
  const scoped = name.startsWith('@');
  const meta = await fetchJson(`https://registry.npmjs.org/${name}/${version}`);
  const tgzPath = join(root, `.tmp-${destName.replace('/', '-')}.tgz`);
  await download(meta.dist.tarball, tgzPath);
  const extractDir = join(root, '.tmp-extract');
  rmSync(extractDir, { recursive: true, force: true });
  await extractTarGz(tgzPath, extractDir);
  const target = join(nodeModules, destName);
  mkdirSync(dirname(target), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  renameSync(join(extractDir, 'package'), target);
  rmSync(extractDir, { recursive: true, force: true });
  rmSync(tgzPath, { force: true });
}

async function installEsbuild() {
  if (existsSync(join(nodeModules, 'esbuild', 'bin', 'esbuild'))) {
    return;
  }
  mkdirSync(nodeModules, { recursive: true });
  await installPackage('esbuild', esbuildVersion);
  await installPackage(platformPkg, esbuildVersion, '@esbuild/win32-x64');
}

await installEsbuild();
await import('./vercel-build.mjs');
