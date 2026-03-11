// Feature: body-trace, Property 18: Multiple markers per session
import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  createSession,
  addMarker,
  getActiveSession,
  clearActiveSessions,
} from "../pain-session-manager";
import type { PainMarker } from "@bodytrace/shared";

/**
 * Validates: Requirements 8.2
 *
 * Property 18: Multiple markers per session
 * For any Pain Session, adding N Pain Markers should result in the session
 * containing exactly N markers, and each marker should reference the correct session ID.
 */

const painTypes = [
  "sharp", "dull", "burning", "throbbing",
  "aching", "stabbing", "tingling", "numbness",
] as const;

const markerStatuses = ["active", "resolved", "historical"] as const;

/** Arbitrary that generates a valid PainMarker with a random ID and properties. */
const arbPainMarker = fc.record({
  id: fc.uuid(),
  sessionId: fc.constant(""), // will be overridden by addMarker
  location: fc.record({
    region: fc.record({
      id: fc.stringMatching(/^[a-z]+-[a-z]+$/),
      name: fc.string({ minLength: 1, maxLength: 30 }),
      bodySystem: fc.constant("musculoskeletal"),
    }),
    coordinates: fc.record({
      x: fc.float({ min: -1, max: 1, noNaN: true }),
      y: fc.float({ min: -1, max: 1, noNaN: true }),
      z: fc.float({ min: -1, max: 1, noNaN: true }),
    }),
  }),
  boundary: fc.constant(undefined),
  intensity: fc.integer({ min: 0, max: 10 }),
  createdAt: fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }),
  status: fc.constantFrom(...markerStatuses),
}) as fc.Arbitrary<PainMarker>;

describe("Property 18: Multiple markers per session", () => {
  beforeEach(() => {
    clearActiveSessions();
  });

  it("should contain exactly N markers after adding N, each referencing the correct session ID", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.array(arbPainMarker, { minLength: 50, maxLength: 50 }),
        (count, markerPool) => {
          clearActiveSessions();

          const session = createSession("user-test");
          const markersToAdd = markerPool.slice(0, count);

          // Add each marker to the session
          for (const marker of markersToAdd) {
            addMarker(session.id, marker);
          }

          // Retrieve the session and verify
          const retrieved = getActiveSession(session.id);
          expect(retrieved).toBeDefined();

          // Session should contain exactly N markers
          expect(retrieved!.markers).toHaveLength(count);

          // Each marker should reference the correct session ID
          for (const marker of retrieved!.markers) {
            expect(marker.sessionId).toBe(session.id);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
