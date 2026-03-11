import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "fake-indexeddb/auto";
import type { PainSession } from "@bodytrace/shared";
import {
  cacheSession,
  getCachedSessions,
  removeCachedSession,
  syncCachedSessions,
} from "../offline-cache";

/** Helper to build a minimal valid PainSession. */
function makeSession(overrides: Partial<PainSession> = {}): PainSession {
  return {
    id: overrides.id ?? "session-1",
    userId: "user-1",
    markers: [],
    descriptors: [],
    status: "in-progress",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

/**
 * Delete the IndexedDB database between tests so each test starts clean.
 */
function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase("bodytrace-offline");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

describe("offline-cache", () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
    vi.restoreAllMocks();
  });

  describe("cacheSession / getCachedSessions", () => {
    it("stores and retrieves a session", async () => {
      const session = makeSession();
      await cacheSession(session);

      const cached = await getCachedSessions();
      expect(cached).toHaveLength(1);
      expect(cached[0].id).toBe("session-1");
      expect(cached[0].userId).toBe("user-1");
    });

    it("preserves Date fields through serialization round-trip", async () => {
      const session = makeSession({
        createdAt: new Date("2025-06-15T10:30:00Z"),
      });
      await cacheSession(session);

      const cached = await getCachedSessions();
      expect(cached[0].createdAt).toBeInstanceOf(Date);
      expect(cached[0].createdAt.toISOString()).toBe("2025-06-15T10:30:00.000Z");
    });

    it("stores multiple sessions", async () => {
      await cacheSession(makeSession({ id: "s1" }));
      await cacheSession(makeSession({ id: "s2" }));
      await cacheSession(makeSession({ id: "s3" }));

      const cached = await getCachedSessions();
      expect(cached).toHaveLength(3);
      const ids = cached.map((s) => s.id).sort();
      expect(ids).toEqual(["s1", "s2", "s3"]);
    });

    it("overwrites a session with the same ID", async () => {
      await cacheSession(makeSession({ id: "s1", status: "in-progress" }));
      await cacheSession(makeSession({ id: "s1", status: "completed" }));

      const cached = await getCachedSessions();
      expect(cached).toHaveLength(1);
      expect(cached[0].status).toBe("completed");
    });

    it("returns empty array when no sessions are cached", async () => {
      const cached = await getCachedSessions();
      expect(cached).toEqual([]);
    });
  });

  describe("removeCachedSession", () => {
    it("removes a specific session by ID", async () => {
      await cacheSession(makeSession({ id: "s1" }));
      await cacheSession(makeSession({ id: "s2" }));

      await removeCachedSession("s1");

      const cached = await getCachedSessions();
      expect(cached).toHaveLength(1);
      expect(cached[0].id).toBe("s2");
    });

    it("does nothing when removing a non-existent session", async () => {
      await cacheSession(makeSession({ id: "s1" }));
      await removeCachedSession("non-existent");

      const cached = await getCachedSessions();
      expect(cached).toHaveLength(1);
    });
  });

  describe("syncCachedSessions", () => {
    it("syncs sessions successfully and removes them from cache", async () => {
      await cacheSession(makeSession({ id: "s1" }));
      await cacheSession(makeSession({ id: "s2" }));

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      const result = await syncCachedSessions("http://localhost:3001");

      expect(result.synced.sort()).toEqual(["s1", "s2"]);
      expect(result.failed).toEqual([]);
      expect(result.conflicts).toEqual([]);

      const remaining = await getCachedSessions();
      expect(remaining).toHaveLength(0);
    });

    it("handles 409 conflict by preserving session as draft", async () => {
      await cacheSession(makeSession({ id: "s1", status: "completed" }));

      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 409 });
      vi.stubGlobal("fetch", mockFetch);

      const result = await syncCachedSessions("http://localhost:3001");

      expect(result.conflicts).toEqual(["s1"]);
      expect(result.synced).toEqual([]);

      const remaining = await getCachedSessions();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].status).toBe("in-progress");
    });

    it("keeps sessions cached on server error", async () => {
      await cacheSession(makeSession({ id: "s1" }));

      const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      vi.stubGlobal("fetch", mockFetch);

      const result = await syncCachedSessions("http://localhost:3001");

      expect(result.failed).toEqual(["s1"]);
      const remaining = await getCachedSessions();
      expect(remaining).toHaveLength(1);
    });

    it("keeps sessions cached on network error", async () => {
      await cacheSession(makeSession({ id: "s1" }));

      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", mockFetch);

      const result = await syncCachedSessions("http://localhost:3001");

      expect(result.failed).toEqual(["s1"]);
      const remaining = await getCachedSessions();
      expect(remaining).toHaveLength(1);
    });

    it("sends correct POST request to the API", async () => {
      const session = makeSession({ id: "s1" });
      await cacheSession(session);

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      await syncCachedSessions("http://localhost:3001");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/sessions",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("returns empty result when no sessions are cached", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      const result = await syncCachedSessions("http://localhost:3001");

      expect(result).toEqual({ synced: [], failed: [], conflicts: [] });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("handles mixed results across multiple sessions", async () => {
      await cacheSession(makeSession({ id: "s1" }));
      await cacheSession(makeSession({ id: "s2" }));
      await cacheSession(makeSession({ id: "s3" }));

      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 409 })
        .mockRejectedValueOnce(new Error("Network error"));
      vi.stubGlobal("fetch", mockFetch);

      const result = await syncCachedSessions("http://localhost:3001");

      expect(result.synced).toHaveLength(1);
      expect(result.conflicts).toHaveLength(1);
      expect(result.failed).toHaveLength(1);

      // s1 synced (removed), s2 conflict (kept as draft), s3 failed (kept)
      const remaining = await getCachedSessions();
      expect(remaining).toHaveLength(2);
    });
  });
});
