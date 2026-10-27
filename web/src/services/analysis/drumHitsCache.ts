// Stored drum analyses (drumHits.ts), in IndexedDB: Folia keeps them in its own database (services/db)
// under DRUM_HITS_PREFIX; a whole track's analysis holds typed arrays, too large for localStorage.

/** A track's drum hits off htdemucs' drum stem; the version is part of the prefix. */
export const DRUM_HITS_PREFIX = 'drum_hits_v1_';

const DB_NAME = 'ryanmusic-analysis';
const STORE = 'cache';

let opened: Promise<IDBDatabase | null> | null = null;

const open = (): Promise<IDBDatabase | null> => {
    if (typeof indexedDB === 'undefined') return Promise.resolve(null);
    opened ??= new Promise<IDBDatabase | null>((resolve) => {
        try {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
    return opened;
};

export const getFromCache = async <T>(key: string): Promise<T | null> => {
    const db = await open();
    if (!db) return null;
    return new Promise<T | null>((resolve) => {
        try {
            const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
            request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
            request.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
};

export const saveToCache = async (key: string, value: unknown): Promise<void> => {
    const db = await open();
    if (!db) return;
    await new Promise<void>((resolve) => {
        try {
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
            tx.onabort = () => resolve();
        } catch {
            resolve();
        }
    });
};
