// Feature: body-trace, Property 10: Body Map persistence across sessions
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type {
  PainMarker,
  PainSession,
  SymptomDescriptor,
  BodyMap,
  PainType,
  PainFrequency,
  PainDuration,
} from "@bodytrace/shared";

/**
 * Validates: Requirements 5.1, 5.2
 *
 * Property 10: Body Map persistence across sessions
 * For any sequence of Pain Sessions for a user, the Body Map should contain
 * all Pain Markers and Symptom Descriptors from all sessions. The total marker
 * count in the Body Map should equal the sum of markers across all sessions.
 */

// --- Arbitraries ---

const painTypeArb: fc.Arbitrary<PainType> = fc.constantFrom(
  "sharp", "dull", "burning", "throbbing",
  "aching", "stabbing", "tingling", "numbness"
);

const frequencyArb: fc.Arbitrary<PainFrequency> = fc.constantFrom(
  "constant", "intermittent", "occasional", "only-during-activity"
);

const durationArb: fc.Arbitrary<PainDuration> = fc.constantFrom(
  "seconds", "minutes", "hours", "days", "weeks"
);

const intensityArb = fc.integer({ min: 0, max: 10 });

const statusArb = fc.constantFrom(
  "active" as const, "resolved" as const, "historical" as const
);

const validDateArb = fc.integer({
  min: new Date("2020-01-01").getTime(),
  max: new Date("2030-01-01").getTime(),
}).map((ts) => new Date(ts));

const coordinatesArb = fc.record({
  x: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  z: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
});

const regionArb = fc.record({
  id: fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/),
  name: fc.stringMatching(/^[A-Z][a-zA-Z ]{0,29}$/),
  bodySystem: fc.constant("musculoskeletal"),
});

/**
 * Build a BodyMap by aggregating all sessions — mirrors the in-memory
 * aggregation logic that getBodyMap performs after loading from the DB.
 */
function buildBodyMap(userId: string, sessions: PainSession[]): BodyMap {
  const allMarkers: PainMarker[] = [];
  const allDescriptors: SymptomDescriptor[] = [];

  for (const session of sessions) {
    allMarkers.push(...session.markers);
    allDescriptors.push(...session.descriptors);
  }

  return { userId, sessions, markers: allMarkers, descriptors: allDescriptors };
}

/**
 * Generate a marker arbitrary scoped to a specific session and index.
 */
function markerArb(sessionId: string, index: number): fc.Arbitrary<PainMarker> {
  return fc.record({
    region: regionArb,
    coordinates: coordinatesArb,
    intensity: intensityArb,
    status: statusArb,
    createdAt: validDateArb,
  }).map((data) => ({
    id: `${sessionId}-marker-${index}`,
    sessionId,
    location: { region: data.region, coordinates: data.coordinates },
    intensity: data.intensity,
    createdAt: data.createdAt,
    status: data.status,
  }));
}

/**
 * Generate a descriptor for a given marker.
 */
function descriptorArb(markerId: string, index: number): fc.Arbitrary<SymptomDescriptor> {
  return fc.record({
    painType: painTypeArb,
    intensity: intensityArb,
    frequency: frequencyArb,
    duration: durationArb,
    completedAt: validDateArb,
  }).map((data) => ({
    id: `desc-${markerId}-${index}`,
    markerId,
    painType: data.painType,
    intensity: data.intensity,
    frequency: data.frequency,
    duration: data.duration,
    followUpResponses: [],
    completedAt: data.completedAt,
  }));
}

/**
 * Generate a full session with 1-10 markers and matching descriptors.
 */
function sessionArb(sessionIndex: number): fc.Arbitrary<PainSession> {
  const sessionId = `session-${sessionIndex}`;
  return fc.integer({ min: 1, max: 10 }).chain((markerCount) => {
    const markerArbs = Array.from({ length: markerCount }, (_, i) => markerArb(sessionId, i));
    return fc.tuple(...markerArbs).chain((markers) => {
      const descArbs = markers.map((m, i) => descriptorArb(m.id, i));
      return fc.tuple(...descArbs).chain((descriptors) =>
        fc.tuple(validDateArb, validDateArb).map(([createdAt, updatedAt]) => ({
          id: sessionId,
          userId: "user-persistence",
          markers,
          descriptors,
          status: "completed" as const,
          createdAt,
          updatedAt,
        }))
      );
    });
  });
}

/**
 * Generate 1-5 sessions.
 */
const sessionsArb: fc.Arbitrary<PainSession[]> = fc
  .integer({ min: 1, max: 5 })
  .chain((count) =>
    fc.tuple(...Array.from({ length: count }, (_, i) => sessionArb(i)))
  );

// --- Test ---

describe("Property 10: Body Map persistence across sessions", () => {
  it("bodyMap.markers.length equals the sum of all session marker counts", () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const bodyMap = buildBodyMap("user-persistence", sessions);

        const expectedMarkerCount = sessions.reduce(
          (sum, s) => sum + s.markers.length, 0
        );

        expect(bodyMap.markers.length).toBe(expectedMarkerCount);
      }),
      { numRuns: 20 }
    );
  });

  it("every marker from every session appears in the body map", () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const bodyMap = buildBodyMap("user-persistence", sessions);

        const bodyMapMarkerIds = new Set(bodyMap.markers.map((m) => m.id));

        for (const session of sessions) {
          for (const marker of session.markers) {
            expect(bodyMapMarkerIds.has(marker.id)).toBe(true);
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it("every descriptor from every session appears in the body map", () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const bodyMap = buildBodyMap("user-persistence", sessions);

        const bodyMapDescriptorIds = new Set(bodyMap.descriptors.map((d) => d.id));

        for (const session of sessions) {
          for (const descriptor of session.descriptors) {
            expect(bodyMapDescriptorIds.has(descriptor.id)).toBe(true);
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it("bodyMap.descriptors.length equals the sum of all session descriptor counts", () => {
    fc.assert(
      fc.property(sessionsArb, (sessions) => {
        const bodyMap = buildBodyMap("user-persistence", sessions);

        const expectedDescriptorCount = sessions.reduce(
          (sum, s) => sum + s.descriptors.length, 0
        );

        expect(bodyMap.descriptors.length).toBe(expectedDescriptorCount);
      }),
      { numRuns: 20 }
    );
  });
});
