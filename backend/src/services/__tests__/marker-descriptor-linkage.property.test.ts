// Feature: body-trace, Property 4: Marker-Descriptor linkage
import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import {
  createSession,
  addMarker,
  addDescriptor,
  saveSession,
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
 * Validates: Requirements 2.5, 5.4
 *
 * Property 4: Marker-Descriptor linkage
 * For any Pain Marker with a completed characterization, storing the Symptom Descriptor
 * and then retrieving it by marker ID should return the same descriptor data,
 * including all follow-up responses.
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
    followUpResponses: fc.array(followUpResponseArb, { minLength: 0, maxLength: 5 }),
  });

// Generate a paired marker + descriptor for a given index
const markerDescriptorPairArb = (index: number) =>
  fc.tuple(markerArb(index), descriptorArb(index));

// Generate 1-10 marker/descriptor pairs
const markersWithDescriptorsArb = fc
  .integer({ min: 1, max: 10 })
  .chain((count) =>
    fc.tuple(
      ...Array.from({ length: count }, (_, i) => markerDescriptorPairArb(i))
    )
  );

// --- Mock Pool ---

/**
 * Creates an in-memory mock pool that captures INSERT data during saveSession
 * and returns it during retrieval queries.
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

      // SELECT symptom_descriptors by marker_id
      if (sql.includes("FROM symptom_descriptors") && sql.includes("WHERE marker_id")) {
        const markerId = params![0];
        const matching = descriptors.filter((d) => d.marker_id === markerId);
        return { rows: matching };
      }

      // SELECT follow_up_responses by descriptor_id
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

/**
 * Retrieve a descriptor by marker ID from the mock database.
 */
async function getDescriptorByMarkerId(
  markerId: string,
  pool: any
): Promise<SymptomDescriptor | null> {
  const client = await pool.connect();
  try {
    // Query descriptor
    const descResult = await client.query(
      `SELECT id, marker_id, pain_type, intensity, frequency, duration, completed_at
       FROM symptom_descriptors WHERE marker_id = $1`,
      [markerId]
    );

    if (descResult.rows.length === 0) {
      return null;
    }

    const d = descResult.rows[0];

    // Query follow-up responses
    const respResult = await client.query(
      `SELECT question_id, question_text, response, answered_at
       FROM follow_up_responses WHERE descriptor_id = $1 ORDER BY answered_at`,
      [d.id]
    );

    const followUpResponses: FollowUpResponse[] = respResult.rows.map(
      (r: any) => ({
        questionId: r.question_id,
        questionText: r.question_text,
        response: r.response,
        answeredAt: new Date(r.answered_at),
      })
    );

    return {
      id: d.id,
      markerId: d.marker_id,
      painType: d.pain_type,
      intensity: d.intensity,
      frequency: d.frequency,
      duration: d.duration,
      followUpResponses,
      completedAt: new Date(d.completed_at),
    };
  } finally {
    client.release();
  }
}

// --- Test ---

describe("Property 4: Marker-Descriptor linkage", () => {
  beforeEach(() => {
    clearActiveSessions();
  });

  it("should preserve marker-descriptor linkage and all follow-up responses through storage and retrieval", async () => {
    await fc.assert(
      fc.asyncProperty(markersWithDescriptorsArb, async (pairs) => {
        clearActiveSessions();

        const mockPool = createMockPool();
        const session = createSession("user-linkage-test");

        // Store all markers and descriptors
        const originalDescriptors: Map<string, SymptomDescriptor> = new Map();

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
          originalDescriptors.set(marker.id, descriptor);
        }

        // Save session to mock database
        await saveSession(session.id, mockPool);

        // Retrieve each descriptor by marker ID and verify linkage
        for (const [markerId, originalDescriptor] of originalDescriptors) {
          const retrieved = await getDescriptorByMarkerId(markerId, mockPool);

          // Verify descriptor was retrieved
          expect(retrieved).not.toBeNull();
          expect(retrieved!.id).toBe(originalDescriptor.id);
          expect(retrieved!.markerId).toBe(markerId);

          // Verify all descriptor fields
          expect(retrieved!.painType).toBe(originalDescriptor.painType);
          expect(retrieved!.intensity).toBe(originalDescriptor.intensity);
          expect(retrieved!.frequency).toBe(originalDescriptor.frequency);
          expect(retrieved!.duration).toBe(originalDescriptor.duration);
          expect(retrieved!.completedAt.toISOString()).toBe(
            originalDescriptor.completedAt.toISOString()
          );

          // Verify all follow-up responses are preserved
          expect(retrieved!.followUpResponses).toHaveLength(
            originalDescriptor.followUpResponses.length
          );

          // Sort both by answeredAt for stable comparison
          const origResponses = [...originalDescriptor.followUpResponses].sort(
            (a, b) => a.answeredAt.getTime() - b.answeredAt.getTime()
          );
          const retrievedResponses = [...retrieved!.followUpResponses].sort(
            (a, b) => a.answeredAt.getTime() - b.answeredAt.getTime()
          );

          for (let i = 0; i < origResponses.length; i++) {
            expect(retrievedResponses[i].questionId).toBe(origResponses[i].questionId);
            expect(retrievedResponses[i].questionText).toBe(origResponses[i].questionText);
            expect(retrievedResponses[i].response).toBe(origResponses[i].response);
            expect(retrievedResponses[i].answeredAt.toISOString()).toBe(
              origResponses[i].answeredAt.toISOString()
            );
          }
        }
      }),
      { numRuns: 20 }
    );
  });
});
