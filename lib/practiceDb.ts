/**
 * IndexedDB helper for persisting practice recording drafts.
 * Saves chunks every 30 s so a crash or accidental tab-close
 * doesn't lose the student's work.
 */

const DB_NAME = 'cadenza_practice';
const STORE   = 'draft';
const KEY     = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

export interface PracticeDraft {
  chunks:   Blob[];
  mimeType: string;
  elapsed:  number;   // seconds
  savedAt:  number;   // Date.now()
}

export async function saveDraft(draft: PracticeDraft): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(draft, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch { /* non-critical */ }
}

export async function loadDraft(): Promise<PracticeDraft | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as PracticeDraft) ?? null);
      req.onerror   = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  } catch { /* non-critical */ }
}
