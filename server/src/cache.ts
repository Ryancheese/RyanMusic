import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

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
}
