/**
 * Offline Cache Service
 *
 * Uses IndexedDB to cache PainSession data locally when the backend is
 * unreachable, and synchronizes cached sessions when connectivity is restored.
 *
 * Sync conflict strategy: server data wins; local changes are preserved as drafts.
 */
import type { PainSession } from "@bodytrace/shared";

const DB_NAME = "bodytrace-offline";
const DB_VERSION = 1;
const STORE_NAME = "cached-sessions";

export interface SyncResult {
  synced: string[];
  failed: string[];
  conflicts: string[];
}

/**
 * Open (or create) the IndexedDB database.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Serialize a PainSession for IndexedDB storage.
 * Converts Date objects to ISO strings for safe persistence.
 */
function serializeSession(session: PainSession): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(session, (_key, value) =>
      value instanceof Date ? value.toISOString() : value
    )
  );
}

/**
 * Deserialize a stored record back into a PainSession.
 * Restores ISO date strings to Date objects.
 */
function deserializeSession(record: Record<string, unknown>): PainSession {
  const json = JSON.stringify(record);
  return JSON.parse(json, (_key, value) => {
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
    ) {
      return new Date(value);
    }
    return value;
  }) as PainSession;
}

/**
 * Cache a PainSession in IndexedDB.
 */
export async function cacheSession(session: PainSession): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(serializeSession(session));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Retrieve all cached sessions from IndexedDB.
 */
export async function getCachedSessions(): Promise<PainSession[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      db.close();
      resolve(
        (request.result as Record<string, unknown>[]).map(deserializeSession)
      );
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Remove a single cached session by ID.
 */
export async function removeCachedSession(sessionId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(sessionId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Synchronize all cached sessions with the backend.
 *
 * For each cached session, attempts to POST it to the backend API.
 * - On success (2xx): removes the session from the cache.
 * - On 409 Conflict: server data wins; the local session is preserved
 *   as a draft (status set to "in-progress") and kept in the cache.
 * - On other errors: the session remains cached for a future retry.
 */
export async function syncCachedSessions(
  apiBaseUrl: string
): Promise<SyncResult> {
  const sessions = await getCachedSessions();
  const result: SyncResult = { synced: [], failed: [], conflicts: [] };

  for (const session of sessions) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      });

      if (response.ok) {
        await removeCachedSession(session.id);
        result.synced.push(session.id);
      } else if (response.status === 409) {
        // Conflict — server data wins, preserve local as draft
        const draft: PainSession = { ...session, status: "in-progress" };
        await cacheSession(draft);
        result.conflicts.push(session.id);
      } else {
        // Other server error — keep cached for retry
        result.failed.push(session.id);
      }
    } catch {
      // Network error — keep cached for retry
      result.failed.push(session.id);
    }
  }

  return result;
}
