// Feature: body-trace, Property 5: Signal generation count invariant
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generate } from "../symptom-signal-generator";
import type { PainMarker, SymptomDescriptor } from "@bodytrace/shared";

/**
 * Validates: Requirements 3.1
 *
 * Property 5: Signal generation count invariant
 * For any Pain Session containing N Pain Markers each with a completed
 * Symptom Descriptor, the Symptom Signal Generator should produce exactly
 * N Symptom Signals.
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

const intensityArb = fc.integer({ min: 0, max: 10 });

function buildMarker(index: number): PainMarker {
  return {
    id: `marker-${index}`,
    sessionId: "session-1",
    location: {
      region: {
        id: "left-shoulder",
        name: "Left Shoulder",
        bodySystem: "musculoskeletal",
      },
      coordinates: { x: 0, y: 0, z: 0 },
    },
    intensity: 5,
    createdAt: new Date(),
    status: "active",
  };
}

function buildDescriptor(
  index: number,
  painType: PainMarker["status"] extends string ? string : never,
  intensity: number,
  frequency: string,
  duration: string
): SymptomDescriptor {
  return {
    id: `desc-${index}`,
    markerId: `marker-${index}`,
    painType: painType as SymptomDescriptor["painType"],
    intensity,
    frequency: frequency as SymptomDescriptor["frequency"],
    duration: duration as SymptomDescriptor["duration"],
    followUpResponses: [],
    completedAt: new Date(),
  };
}

describe("Property 5: Signal generation count invariant", () => {
  it("should produce exactly N signals for N marker-descriptor pairs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.array(
          fc.record({
            painType: painTypeArb,
            intensity: intensityArb,
            frequency: frequencyArb,
            duration: durationArb,
          }),
          { minLength: 20, maxLength: 20 }
        ),
        (markerCount, descriptorFields) => {
          const signals = [];

          for (let i = 0; i < markerCount; i++) {
            const marker = buildMarker(i);
            const fields = descriptorFields[i];
            const descriptor = buildDescriptor(
              i,
              fields.painType,
              fields.intensity,
              fields.frequency,
              fields.duration
            );
            const signal = generate(marker, descriptor);
            signals.push(signal);
          }

          expect(signals.length).toBe(markerCount);

          // Each signal should be a valid object with required fields
          for (const signal of signals) {
            expect(signal).toBeDefined();
            expect(signal.id).toBeDefined();
            expect(typeof signal.id).toBe("string");
            expect(signal.markerId).toBeDefined();
            expect(signal.anatomicalRegion).toBeDefined();
            expect(signal.painType).toBeDefined();
            expect(signal.timestamp).toBeInstanceOf(Date);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
