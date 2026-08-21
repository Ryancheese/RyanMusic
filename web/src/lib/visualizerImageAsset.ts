interface StoredVisualizerImageAsset {
  id: string;
  name: string;
  mimeType: string;
  blob: Blob;
}

const DB_NAME = 'ryanmusic-visualizer-assets';
const STORE_NAME = 'assets';
const SUPPORTED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('打开图片存储失败'));
});

export const getStoredVisualizerImageAsset = async <T extends StoredVisualizerImageAsset>(
  key: string,
): Promise<T | null> => {
  try {
    const db = await openDb();
    const stored = await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => reject(request.error || new Error('读取图片失败'));
    });
    db.close();
    if (!stored?.blob || !(stored.blob instanceof Blob) || typeof stored.name !== 'string') {
      return null;
    }
    return stored;
  } catch {
    return null;
  }
};

export const saveStoredVisualizerImageAsset = async <T extends StoredVisualizerImageAsset>(
  key: string,
  image: T,
): Promise<void> => {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(image, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('保存图片失败'));
  });
  db.close();
};

export const clearStoredVisualizerImageAsset = async (key: string): Promise<void> => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('删除图片失败'));
    });
    db.close();
  } catch {
    // ignore
  }
};

export const isSupportedVisualizerImageFile = (file: File) => {
  const lowerName = file.name.toLowerCase();
  const hasSupportedExtension = SUPPORTED_IMAGE_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  return file.type.startsWith('image/') || hasSupportedExtension;
};

export const buildStoredVisualizerImageAsset = <T extends StoredVisualizerImageAsset>(file: File): T => ({
  id: `${Date.now()}-${file.name}`,
  name: file.name,
  mimeType: file.type || 'application/octet-stream',
  blob: file,
} as unknown as T);
