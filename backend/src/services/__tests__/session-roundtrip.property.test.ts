// Feature: body-trace, Property 19: Session save/resume round-trip
import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  createSession,
  addMarker,
  addDescriptor,
  saveSession,
  resumeSession,
  clearActiveSessions,
} from "../pain-session-manager";
import type {
  PainMarker,
  SymptomDescriptor,
  FollowUpResponse,
  PainType,
  PainFrequency,
  PainDuration,
} from "@bodytrace/shared";

/**
 * Validates: Requirements 8.3, 8.4
 *
 * Property 19: Session save/resume round-trip
 * For any Pain Session with markers, descriptors, and follow-up responses,
 * saving the session and then resuming it should restore all data identically —
 * same markers, same descriptors, same follow-up responses.
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

const statusArb = fc.constantFrom("active" as const, "resolved" as const, "historical" as const);

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
  // resumeSession hardcodes bodySystem to "musculoskeletal", so use that
  bodySystem: fc.constant("musculoskeletal"),
});

const followUpResponseArb: fc.Arbitrary<FollowUpResponse> = fc.record({
  questionId: fc.stringMatching(/^q-[a-z0-9]{1,10}$/),
  questionText: fc.stringMatching(/^[A-Z][a-zA-Z ?]{1,49}$/),
  response: fc.stringMatching(/^[A-Za-z ]{1,49}$/),
  answeredAt: validDateArb,
});

const markerArb = (index: number) =>
  fc.record({
    id: fc.constant(`marker-${index}`),
    intensity: intensityArb,
    status: statusArb,
    createdAt: validDateArb,
    region: regionArb,
    coordinates: coordinatesArb,
  });

const descriptorArb = (markerIndex: number) =>
  fc.record({
    id: fc.constant(`desc-${markerIndex}`),
    painType: painTypeArb,
    intensity: intensityArb,
    frequency: frequencyArb,
    duration: durationArb,
    completedAt: validDateArb,
    followUpResponses: fc.array(followUpResponseArb, { minLength: 0, maxLength: 3 }),
  });

// Generate a paired marker + descriptor for a given index
const markerDescriptorPairArb = (index: number) =>
  fc.tuple(markerArb(index), descriptorArb(index));

// Generate 1-5 marker/descriptor pairs
const sessionDataArb = fc
  .integer({ min: 1, max: 5 })
  .chain((count) =>
    fc.tuple(
      ...Array.from({ length: count }, (_, i) => markerDescriptorPairArb(i))
    )
  );

// --- Mock Pool ---

/**
 * Creates an in-memory mock pool that captures INSERT data during saveSession
 * and returns it during resumeSession queries.
 */
function createMockPool() {
  const sessions: Record<string, any> = {};
  const markers: any[] = [];
  const descriptors: any[] = [];
  const followUpResponses: any[] = [];

  const mockClient = {
    query: async (sql: string, params?: any[]) => {
      const trimmed = sql.trim().toUpperCase();

      // Transaction control
      if (trimmed === "BEGIN" || trimmed === "COMMIT" || trimmed === "ROLLBACK") {
        return { rows: [] };
      }

      // INSERT pain_sessions
      if (sql.includes("INSERT INTO pain_sessions")) {
        sessions[params![0]] = {
          id: params![0],
          user_id: params![1],
          status: params![2],
          created_at: params![3],
          updated_at: params![4],
        };
        return { rows: [] };
      }

      // INSERT pain_markers
      if (sql.includes("INSERT INTO pain_markers")) {
        markers.push({
          id: params![0],
          session_id: params![1],
          region_id: params![2],
          region_name: params![3],
          coordinates: JSON.parse(params![4]),
          boundary: params![5] ? JSON.parse(params![5]) : null,
          intensity: params![6],
          status: params![7],
          created_at: params![8],
        });
        return { rows: [] };
      }

      // INSERT symptom_descriptors
      if (sql.includes("INSERT INTO symptom_descriptors")) {
        descriptors.push({
          id: params![0],
          marker_id: params![1],
          pain_type: params![2],
          intensity: params![3],
          frequency: params![4],
          duration: params![5],
          completed_at: params![6],
        });
        return { rows: [] };
      }

      // INSERT follow_up_responses
      if (sql.includes("INSERT INTO follow_up_responses")) {
        followUpResponses.push({
          id: params![0],
          descriptor_id: params![1],
          question_id: params![2],
          question_text: params![3],
          response: params![4],
          answered_at: params![5],
        });
        return { rows: [] };
      }

      // SELECT pain_sessions
      if (sql.includes("FROM pain_sessions")) {
        const sessionId = params![0];
        const s = sessions[sessionId];
        return { rows: s ? [s] : [] };
      }

      // SELECT pain_markers
      if (sql.includes("FROM pain_markers")) {
        const sessionId = params![0];
        return { rows: markers.filter((m) => m.session_id === sessionId) };
      }

      // SELECT symptom_descriptors
      if (sql.includes("FROM symptom_descriptors")) {
        const markerIds: string[] = params![0];
        return { rows: descriptors.filter((d) => markerIds.includes(d.marker_id)) };
      }

      // SELECT follow_up_responses
      if (sql.includes("FROM follow_up_responses")) {
        const descriptorId = params![0];
        const matching = followUpResponses
          .filter((r) => r.descriptor_id === descriptorId)
          .sort(
            (a: any, b: any) =>
              new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime()
          );
        return { rows: matching };
      }

      return { rows: [] };
    },
    release: () => {},
  };

  return {
    connect: async () => mockClient,
  } as any;
}

// --- Test ---

describe("Property 19: Session save/resume round-trip", () => {
  beforeEach(() => {
    clearActiveSessions();
  });

  it("should restore identical markers, descriptors, and follow-up responses after save → resume", async () => {
    await fc.assert(
      fc.asyncProperty(sessionDataArb, async (pairs) => {
        clearActiveSessions();

        const mockPool = createMockPool();
        const session = createSession("user-roundtrip");

        // Build markers and descriptors from generated pairs
        const originalMarkers: PainMarker[] = [];
        const originalDescriptors: SymptomDescriptor[] = [];

        for (const [markerData, descData] of pairs) {
          const marker: PainMarker = {
            id: markerData.id,
            sessionId: session.id,
            location: {
              region: markerData.region,
              coordinates: markerData.coordinates,
            },
            intensity: markerData.intensity,
            createdAt: markerData.createdAt,
            status: markerData.status,
          };

          const descriptor: SymptomDescriptor = {
            id: descData.id,
            markerId: marker.id,
            painType: descData.painType,
            intensity: descData.intensity,
            frequency: descData.frequency,
            duration: descData.duration,
            followUpResponses: descData.followUpResponses,
            completedAt: descData.completedAt,
          };

          addMarker(session.id, marker);
          addDescriptor(session.id, descriptor);
          originalMarkers.push(marker);
          originalDescriptors.push(descriptor);
        }

        // Save session (removes from active sessions)
        await saveSession(session.id, mockPool);

        // Resume session (loads from mock DB)
        const resumed = await resumeSession(session.id, mockPool);

        // Verify session identity
        expect(resumed.id).toBe(session.id);
        expect(resumed.userId).toBe("user-roundtrip");

        // Verify marker count
        expect(resumed.markers).toHaveLength(originalMarkers.length);

        // Verify each marker
        for (let i = 0; i < originalMarkers.length; i++) {
          const orig = originalMarkers[i];
          const restored = resumed.markers.find((m) => m.id === orig.id);
          expect(restored).toBeDefined();
          expect(restored!.sessionId).toBe(session.id);
          expect(restored!.location.region.id).toBe(orig.location.region.id);
          expect(restored!.location.region.name).toBe(orig.location.region.name);
          // JSON round-trip normalizes -0 to 0, so normalize before comparison
          const normalize = (v: number) => (Object.is(v, -0) ? 0 : v);
          expect(restored!.location.coordinates.x).toBe(normalize(orig.location.coordinates.x));
          expect(restored!.location.coordinates.y).toBe(normalize(orig.location.coordinates.y));
          expect(restored!.location.coordinates.z).toBe(normalize(orig.location.coordinates.z));
          expect(restored!.intensity).toBe(orig.intensity);
          expect(restored!.status).toBe(orig.status);
          expect(restored!.createdAt.toISOString()).toBe(orig.createdAt.toISOString());
        }

        // Verify descriptor count
        expect(resumed.descriptors).toHaveLength(originalDescriptors.length);

        // Verify each descriptor and its follow-up responses
        for (let i = 0; i < originalDescriptors.length; i++) {
          const orig = originalDescriptors[i];
          const restored = resumed.descriptors.find((d) => d.id === orig.id);
          expect(restored).toBeDefined();
          expect(restored!.markerId).toBe(orig.markerId);
          expect(restored!.painType).toBe(orig.painType);
          expect(restored!.intensity).toBe(orig.intensity);
          expect(restored!.frequency).toBe(orig.frequency);
          expect(restored!.duration).toBe(orig.duration);
          expect(restored!.completedAt.toISOString()).toBe(orig.completedAt.toISOString());

          // Verify follow-up responses
          expect(restored!.followUpResponses).toHaveLength(orig.followUpResponses.length);
          // Sort both by questionId for stable comparison
          const origResponses = [...orig.followUpResponses].sort((a, b) =>
            a.answeredAt.getTime() - b.answeredAt.getTime()
          );
          const restoredResponses = [...restored!.followUpResponses].sort((a, b) =>
            a.answeredAt.getTime() - b.answeredAt.getTime()
          );
          for (let j = 0; j < origResponses.length; j++) {
            expect(restoredResponses[j].questionId).toBe(origResponses[j].questionId);
            expect(restoredResponses[j].questionText).toBe(origResponses[j].questionText);
            expect(restoredResponses[j].response).toBe(origResponses[j].response);
            expect(restoredResponses[j].answeredAt.toISOString()).toBe(
              origResponses[j].answeredAt.toISOString()
            );
          }
        }
      }),
      { numRuns: 20 }
    );
  });
});
