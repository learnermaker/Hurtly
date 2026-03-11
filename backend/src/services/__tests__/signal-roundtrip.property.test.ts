// Feature: body-trace, Property 7: Symptom Signal serialization round-trip
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generate, serialize, parse } from "../symptom-signal-generator";
import type { PainMarker, SymptomDescriptor } from "@bodytrace/shared";

/**
 * Validates: Requirements 3.4, 3.5, 3.6
 *
 * Property 7: Symptom Signal serialization round-trip
 * For any valid Symptom Signal object, serializing it to JSON and then
 * parsing the JSON back should produce an equivalent Symptom Signal object.
 */

const painTypeArb = fc.constantFrom(
  "sharp" as const,
  "dull" as const,
  "burning" as const,
  "throbbing" as const,
  "aching" as const,
  "stabbing" as const,
  "tingling" as const,
  "numbness" as const
);

const intensityArb = fc.integer({ min: 0, max: 10 });

const frequencyArb = fc.constantFrom(
  "constant" as const,
  "intermittent" as const,
  "occasional" as const,
  "only-during-activity" as const
);

const durationArb = fc.constantFrom(
  "seconds" as const,
  "minutes" as const,
  "hours" as const,
  "days" as const,
  "weeks" as const
);

const regionArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 30 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  bodySystem: fc.string({ minLength: 1, maxLength: 30 }),
});

const coordinatesArb = fc.record({
  x: fc.double({ min: -100, max: 100, noNaN: true }),
  y: fc.double({ min: -100, max: 100, noNaN: true }),
  z: fc.double({ min: -100, max: 100, noNaN: true }),
});

const validDateArb = fc.integer({
  min: new Date("2020-01-01").getTime(),
  max: new Date("2030-01-01").getTime(),
}).map((ts) => new Date(ts));

const followUpResponseArb = fc.record({
  questionId: fc.string({ minLength: 1, maxLength: 20 }),
  questionText: fc.string({ minLength: 1, maxLength: 100 }),
  response: fc.string({ minLength: 1, maxLength: 200 }),
  answeredAt: validDateArb,
});

const markerArb = fc.record({
  painType: painTypeArb,
  intensity: intensityArb,
  frequency: frequencyArb,
  duration: durationArb,
  region: regionArb,
  coordinates: coordinatesArb,
});

describe("Property 7: Symptom Signal serialization round-trip", () => {
  it("should produce equivalent signals after serialize → parse (no followUpResponses)", () => {
    fc.assert(
      fc.property(markerArb, (fields) => {
        const marker: PainMarker = {
          id: `marker-${fields.region.id}`,
          sessionId: "session-rt",
          location: {
            region: fields.region,
            coordinates: fields.coordinates,
          },
          intensity: fields.intensity,
          createdAt: new Date(),
          status: "active",
        };

        const descriptor: SymptomDescriptor = {
          id: `desc-${fields.region.id}`,
          markerId: marker.id,
          painType: fields.painType,
          intensity: fields.intensity,
          frequency: fields.frequency,
          duration: fields.duration,
          followUpResponses: [],
          completedAt: new Date(),
        };

        const signal = generate(marker, descriptor);
        const json = serialize(signal);
        const restored = parse(json);

        // Compare via serialized form since Date objects won't be === equal
        expect(serialize(restored)).toBe(json);

        // Also verify key fields individually
        expect(restored.id).toBe(signal.id);
        expect(restored.markerId).toBe(signal.markerId);
        expect(restored.anatomicalRegion).toBe(signal.anatomicalRegion);
        expect(restored.painType).toBe(signal.painType);
        expect(restored.intensity).toBe(signal.intensity);
        expect(restored.frequency).toBe(signal.frequency);
        expect(restored.duration).toBe(signal.duration);
        expect(restored.timestamp.toISOString()).toBe(signal.timestamp.toISOString());
      }),
      { numRuns: 20 }
    );
  });

  it("should produce equivalent signals after serialize → parse (with followUpResponses)", () => {
    fc.assert(
      fc.property(
        markerArb,
        fc.array(followUpResponseArb, { minLength: 1, maxLength: 5 }),
        (fields, followUps) => {
          const marker: PainMarker = {
            id: `marker-${fields.region.id}`,
            sessionId: "session-rt",
            location: {
              region: fields.region,
              coordinates: fields.coordinates,
            },
            intensity: fields.intensity,
            createdAt: new Date(),
            status: "active",
          };

          const descriptor: SymptomDescriptor = {
            id: `desc-${fields.region.id}`,
            markerId: marker.id,
            painType: fields.painType,
            intensity: fields.intensity,
            frequency: fields.frequency,
            duration: fields.duration,
            followUpResponses: followUps,
            completedAt: new Date(),
          };

          const signal = generate(marker, descriptor);
          const json = serialize(signal);
          const restored = parse(json);

          // Compare via serialized form for full equivalence
          expect(serialize(restored)).toBe(json);

          // Verify followUpResponses are preserved
          expect(restored.followUpResponses).toBeDefined();
          expect(restored.followUpResponses!.length).toBe(followUps.length);

          for (let i = 0; i < followUps.length; i++) {
            expect(restored.followUpResponses![i].questionId).toBe(followUps[i].questionId);
            expect(restored.followUpResponses![i].questionText).toBe(followUps[i].questionText);
            expect(restored.followUpResponses![i].response).toBe(followUps[i].response);
            expect(restored.followUpResponses![i].answeredAt).toBeInstanceOf(Date);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
