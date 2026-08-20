import type { MonetBackgroundImage } from '../types';

const DB_NAME = 'ryanmusic-bg';
const STORE_NAME = 'customImage';
const RECORD_KEY = 'current';
const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.86;

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('打开背景图存储失败'));
});

export async function saveCustomBackgroundImage(image: MonetBackgroundImage | null): Promise<void> {
  if (image && !image.url) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      if (image?.url) store.put(image, RECORD_KEY);
      else store.delete(RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('保存背景图失败'));
    });
    db.close();
  } catch {
    // 无 IndexedDB 时忽略，内存态仍可用
  }
}

export async function loadCustomBackgroundImage(): Promise<MonetBackgroundImage | null> {
  try {
    const db = await openDb();
    const image = await new Promise<MonetBackgroundImage | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => resolve((request.result as MonetBackgroundImage | undefined) ?? null);
      request.onerror = () => reject(request.error || new Error('读取背景图失败'));
    });
    db.close();
    return image?.url ? image : null;
  } catch {
    return null;
  }
}

const compressDataUrl = (src: string): Promise<string> => new Promise((resolve) => {
  const image = new Image();
  image.onload = () => {
    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    if (scale >= 1 && src.startsWith('data:image/jpeg')) {
      resolve(src);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(src);
      return;
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    try {
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    } catch {
      resolve(src);
    }
  };
  image.onerror = () => resolve(src);
  image.src = src;
});

export async function fileToBackgroundImage(file: File): Promise<MonetBackgroundImage> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
  const keepOriginal = /image\/(gif|svg\+xml)/i.test(file.type);
  const url = keepOriginal ? raw : await compressDataUrl(raw);
  return {
    id: `bg-${Date.now()}`,
    name: file.name || 'background',
    url,
  };
}

export function stripCustomImageUrl(image?: MonetBackgroundImage | null): MonetBackgroundImage | null | undefined {
  if (!image) return image;
  return { id: image.id, name: image.name, url: '' };
}
