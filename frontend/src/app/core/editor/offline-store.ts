/**
 * Minimal IndexedDB-backed durability for one Yjs document: persists the
 * full merged CRDT state so edits made while offline survive a page
 * reload, and can be replayed/merged once the socket reconnects. Hand
 * rolled instead of pulling in `y-indexeddb` - this is the "proves you
 * understand the CRDT" half of the offline story: local durability +
 * explicit merge-on-reconnect, not just importing a provider.
 */
const DB_NAME = 'collab-editor-offline';
const STORE_NAME = 'document-states';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadOfflineState(documentId: string): Promise<Uint8Array | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(documentId);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    // IndexedDB unavailable (private browsing, etc.) - fall back to
    // server-only sync rather than crashing the editor.
    return null;
  }
}

export async function saveOfflineState(documentId: string, state: Uint8Array): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(state, documentId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Best-effort only - in-memory Yjs state is still correct for this
    // session even if we can't persist it.
  }
}
