// IndexedDB client-side offline chapter and translation storage
import type { Translation } from './api';

const DB_NAME = 'manga_manman_offline';
const DB_VERSION = 1;
const STORE_NAME = 'chapters';

export interface OfflineChapter {
  chapterId: string;
  mangaId: string;
  mangaTitle: string;
  chapterNumber: string;
  pages: string[]; // Base64 data URLs or cached URLs
  translations: Record<number, Translation>;
  savedAt: string;
  sizeBytes?: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'chapterId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveOfflineChapter(
  chapterId: string,
  mangaId: string,
  mangaTitle: string,
  chapterNumber: string,
  pages: string[],
  translations: Record<number, Translation>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record: OfflineChapter = {
      chapterId,
      mangaId,
      mangaTitle,
      chapterNumber,
      pages,
      translations,
      savedAt: new Date().toISOString(),
    };

    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getOfflineChapter(chapterId: string): Promise<OfflineChapter | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(chapterId);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function isChapterOffline(chapterId: string): Promise<boolean> {
  const chapter = await getOfflineChapter(chapterId);
  return chapter !== null;
}

export async function getAllOfflineChapters(): Promise<OfflineChapter[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeOfflineChapter(chapterId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(chapterId);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
