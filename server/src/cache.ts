import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** 登录态目录：清理缓存时保留 */
const PRESERVE_DIRS = new Set(['netease_auth', 'qq_auth']);

export class FileCache {
  constructor(private readonly root: string) {
    mkdirSync(root, { recursive: true });
  }

  dir(subdir: string): string {
    const path = join(this.root, subdir);
    mkdirSync(path, { recursive: true });
    return path;
  }

  file(subdir: string, key: string): string {
    const safe = key.replace(/[^a-zA-Z0-9]/g, '_');
    return join(this.dir(subdir), `${safe}.json`);
  }

  read<T = any>(subdir: string, key: string): T | null {
    const path = this.file(subdir, key);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as T;
    } catch {
      return null;
    }
  }

  write(subdir: string, key: string, data: unknown): void {
    writeFileSync(this.file(subdir, key), JSON.stringify(data));
  }

  getTtl(subdir: string, key: string, field = 'url'): string | null {
    const data = this.read<Record<string, any>>(subdir, key);
    if (!data || !data[field] || !data.expires || data.expires < Date.now() / 1000) return null;
    return String(data[field]);
  }

  setTtl(subdir: string, key: string, value: string, ttlSec: number, field = 'url'): void {
    this.write(subdir, key, { [field]: value, expires: Math.floor(Date.now() / 1000) + ttlSec });
  }

  /** 清理可重建缓存，保留登录 Cookie */
  clearSafe(): { removedBytes: number; removedEntries: number; preserved: string[] } {
    let removedBytes = 0;
    let removedEntries = 0;
    const preserved: string[] = [];
    if (!existsSync(this.root)) {
      return { removedBytes: 0, removedEntries: 0, preserved };
    }

    for (const name of readdirSync(this.root)) {
      const full = join(this.root, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory() && PRESERVE_DIRS.has(name)) {
        preserved.push(name);
        continue;
      }
      try {
        removedBytes += measurePath(full);
        rmSync(full, { recursive: true, force: true });
        removedEntries += 1;
      } catch {
        // ignore locked files
      }
    }

    return { removedBytes, removedEntries, preserved };
  }

  /** 当前缓存占用：可清理项 + 保留的登录目录 */
  usage(): {
    rebuildableBytes: number;
    preservedBytes: number;
    totalBytes: number;
    rebuildableEntries: number;
  } {
    let rebuildableBytes = 0;
    let preservedBytes = 0;
    let rebuildableEntries = 0;
    if (!existsSync(this.root)) {
      return {
        rebuildableBytes: 0,
        preservedBytes: 0,
        totalBytes: 0,
        rebuildableEntries: 0,
      };
    }

    for (const name of readdirSync(this.root)) {
      const full = join(this.root, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      const size = measurePath(full);
      if (st.isDirectory() && PRESERVE_DIRS.has(name)) {
        preservedBytes += size;
        continue;
      }
      rebuildableBytes += size;
      rebuildableEntries += 1;
    }

    return {
      rebuildableBytes,
      preservedBytes,
      totalBytes: rebuildableBytes + preservedBytes,
      rebuildableEntries,
    };
  }
}

function measurePath(path: string): number {
  try {
    const st = statSync(path);
    if (st.isFile()) return st.size;
    if (!st.isDirectory()) return 0;
    let total = 0;
    for (const name of readdirSync(path)) {
      total += measurePath(join(path, name));
    }
    return total;
  } catch {
    return 0;
  }
}
