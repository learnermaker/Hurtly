// Feature: body-trace, Property 17: Session ID uniqueness and timestamp presence
import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { createSession, clearActiveSessions } from "../pain-session-manager";

/**
 * Validates: Requirements 8.1
 *
 * Property 17: Session ID uniqueness and timestamp presence
 * For any number of created Pain Sessions, all session IDs should be unique,
 * and every session should have a non-null creation timestamp.
 */

describe("Property 17: Session ID uniqueness and timestamp presence", () => {
  beforeEach(() => {
    clearActiveSessions();
  });

  it("should produce unique IDs and non-null timestamps for any number of sessions", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (count) => {
          clearActiveSessions();

          const sessions = Array.from({ length: count }, () =>
            createSession("user-test")
          );

          // All session IDs must be unique
          const ids = sessions.map((s) => s.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(count);

          // Every session must have a non-null createdAt Date
          for (const session of sessions) {
            expect(session.createdAt).not.toBeNull();
            expect(session.createdAt).toBeInstanceOf(Date);
            expect(Number.isNaN(session.createdAt.getTime())).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
