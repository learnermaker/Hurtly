import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createSession,
  addMarker,
  addDescriptor,
  getActiveSession,
  saveSession,
  resumeSession,
  clearActiveSessions,
} from "../pain-session-manager";
import type {
  PainMarker,
  SymptomDescriptor,
} from "@bodytrace/shared";

function makeMarker(overrides?: Partial<PainMarker>): PainMarker {
  return {
    id: "marker-1",
    sessionId: "",
    location: {
      region: { id: "left-shoulder", name: "Left Shoulder", bodySystem: "musculoskeletal" },
      coordinates: { x: 1, y: 2, z: 3 },
    },
    intensity: 5,
    createdAt: new Date("2024-06-01"),
    status: "active",
    ...overrides,
  };
}

function makeDescriptor(overrides?: Partial<SymptomDescriptor>): SymptomDescriptor {
  return {
    id: "desc-1",
    markerId: "marker-1",
    painType: "sharp",
    intensity: 5,
    frequency: "intermittent",
    duration: "hours",
    followUpResponses: [],
    completedAt: new Date("2024-06-01"),
    ...overrides,
  };
}

describe("PainSessionManager", () => {
  beforeEach(() => {
    clearActiveSessions();
  });

  describe("createSession", () => {
    it("should create a session with a unique UUID", () => {
      const session = createSession("user-1");
      expect(session.id).toBeDefined();
      expect(session.id.length).toBeGreaterThan(0);
      // UUID v4 format
      expect(session.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it("should set createdAt and updatedAt timestamps", () => {
      const before = new Date();
      const session = createSession("user-1");
      const after = new Date();

      expect(session.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(session.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it("should initialize with empty markers and descriptors", () => {
      const session = createSession("user-1");
      expect(session.markers).toEqual([]);
      expect(session.descriptors).toEqual([]);
    });

    it("should set status to in-progress", () => {
      const session = createSession("user-1");
      expect(session.status).toBe("in-progress");
    });

    it("should store the session in the active sessions map", () => {
      const session = createSession("user-1");
      expect(getActiveSession(session.id)).toBe(session);
    });

    it("should generate unique IDs for different sessions", () => {
      const s1 = createSession("user-1");
      const s2 = createSession("user-1");
      expect(s1.id).not.toBe(s2.id);
    });
  });

  describe("addMarker", () => {
    it("should add a marker to the session", () => {
      const session = createSession("user-1");
      const marker = makeMarker();
      addMarker(session.id, marker);

      const updated = getActiveSession(session.id)!;
      expect(updated.markers).toHaveLength(1);
      expect(updated.markers[0].id).toBe("marker-1");
    });

    it("should set the marker sessionId to the session ID", () => {
      const session = createSession("user-1");
      addMarker(session.id, makeMarker());

      const updated = getActiveSession(session.id)!;
      expect(updated.markers[0].sessionId).toBe(session.id);
    });

    it("should allow adding multiple markers", () => {
      const session = createSession("user-1");
      addMarker(session.id, makeMarker({ id: "m1" }));
      addMarker(session.id, makeMarker({ id: "m2" }));
      addMarker(session.id, makeMarker({ id: "m3" }));

      const updated = getActiveSession(session.id)!;
      expect(updated.markers).toHaveLength(3);
    });

    it("should update the session updatedAt timestamp", () => {
      const session = createSession("user-1");
      const originalUpdatedAt = session.updatedAt;

      // Small delay to ensure timestamp difference
      addMarker(session.id, makeMarker());

      const updated = getActiveSession(session.id)!;
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt.getTime()
      );
    });

    it("should throw for a non-existent session", () => {
      expect(() => addMarker("nonexistent", makeMarker())).toThrow(
        "Session not found: nonexistent"
      );
    });
  });

  describe("addDescriptor", () => {
    it("should add a descriptor to the session", () => {
      const session = createSession("user-1");
      addDescriptor(session.id, makeDescriptor());

      const updated = getActiveSession(session.id)!;
      expect(updated.descriptors).toHaveLength(1);
      expect(updated.descriptors[0].painType).toBe("sharp");
    });

    it("should throw for a non-existent session", () => {
      expect(() => addDescriptor("nonexistent", makeDescriptor())).toThrow(
        "Session not found: nonexistent"
      );
    });
  });

  describe("saveSession", () => {
    it("should persist session data using a database transaction", async () => {
      const session = createSession("user-1");
      addMarker(session.id, makeMarker({ id: "m1" }));
      addDescriptor(
        session.id,
        makeDescriptor({
          id: "d1",
          markerId: "m1",
          followUpResponses: [
            {
              questionId: "q1",
              questionText: "When did it start?",
              response: "Yesterday",
              answeredAt: new Date("2024-06-01"),
            },
          ],
        })
      );

      // Mock pool
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as any;

      await saveSession(session.id, mockPool);

      // Should have called BEGIN, session insert, marker insert, descriptor insert, follow-up insert, COMMIT
      const calls = mockClient.query.mock.calls;
      expect(calls[0][0]).toBe("BEGIN");
      expect(calls[calls.length - 1][0]).toBe("COMMIT");

      // Session should be removed from active sessions after save
      expect(getActiveSession(session.id)).toBeUndefined();
    });

    it("should rollback on error", async () => {
      const session = createSession("user-1");
      addMarker(session.id, makeMarker());

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({}) // BEGIN
          .mockRejectedValueOnce(new Error("DB error")), // session insert fails
        release: vi.fn(),
      };
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as any;

      await expect(saveSession(session.id, mockPool)).rejects.toThrow("DB error");

      // Should have called ROLLBACK
      const calls = mockClient.query.mock.calls;
      expect(calls[calls.length - 1][0]).toBe("ROLLBACK");

      // Session should still be in active sessions
      expect(getActiveSession(session.id)).toBeDefined();
    });

    it("should throw for a non-existent session", async () => {
      await expect(saveSession("nonexistent")).rejects.toThrow(
        "Session not found: nonexistent"
      );
    });
  });

  describe("resumeSession", () => {
    it("should return an in-memory session if available", async () => {
      const session = createSession("user-1");
      addMarker(session.id, makeMarker());

      const resumed = await resumeSession(session.id);
      expect(resumed).toBe(session);
    });

    it("should load session from database when not in memory", async () => {
      const sessionId = "db-session-1";
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
          if (sql.includes("pain_sessions")) {
            return {
              rows: [
                {
                  id: sessionId,
                  user_id: "user-1",
                  status: "in-progress",
                  created_at: new Date("2024-06-01"),
                  updated_at: new Date("2024-06-01"),
                },
              ],
            };
          }
          if (sql.includes("pain_markers")) {
            return {
              rows: [
                {
                  id: "m1",
                  session_id: sessionId,
                  region_id: "lower-back",
                  region_name: "Lower Back",
                  coordinates: { x: 0, y: 1, z: 0 },
                  boundary: null,
                  intensity: 8,
                  status: "active",
                  created_at: new Date("2024-06-01"),
                },
              ],
            };
          }
          if (sql.includes("symptom_descriptors")) {
            return {
              rows: [
                {
                  id: "d1",
                  marker_id: "m1",
                  pain_type: "burning",
                  intensity: 8,
                  frequency: "constant",
                  duration: "hours",
                  completed_at: new Date("2024-06-01"),
                },
              ],
            };
          }
          if (sql.includes("follow_up_responses")) {
            return {
              rows: [
                {
                  question_id: "q1",
                  question_text: "Does heat help?",
                  response: "Sometimes",
                  answered_at: new Date("2024-06-01"),
                },
              ],
            };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as any;

      const resumed = await resumeSession(sessionId, mockPool);

      expect(resumed.id).toBe(sessionId);
      expect(resumed.userId).toBe("user-1");
      expect(resumed.markers).toHaveLength(1);
      expect(resumed.markers[0].location.region.name).toBe("Lower Back");
      expect(resumed.descriptors).toHaveLength(1);
      expect(resumed.descriptors[0].painType).toBe("burning");
      expect(resumed.descriptors[0].followUpResponses).toHaveLength(1);
      expect(resumed.descriptors[0].followUpResponses[0].response).toBe("Sometimes");
    });

    it("should throw when session not found in DB", async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      };
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as any;

      await expect(resumeSession("nonexistent", mockPool)).rejects.toThrow(
        "Session not found: nonexistent"
      );
    });

    it("should store resumed session in active sessions for further editing", async () => {
      const sessionId = "db-session-2";
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("pain_sessions")) {
            return {
              rows: [
                {
                  id: sessionId,
                  user_id: "user-2",
                  status: "in-progress",
                  created_at: new Date("2024-06-01"),
                  updated_at: new Date("2024-06-01"),
                },
              ],
            };
          }
          if (sql.includes("pain_markers")) {
            return { rows: [] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };
      const mockPool = {
        connect: vi.fn().mockResolvedValue(mockClient),
      } as any;

      await resumeSession(sessionId, mockPool);
      expect(getActiveSession(sessionId)).toBeDefined();
    });
  });
});
