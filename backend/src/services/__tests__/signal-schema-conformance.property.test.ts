// Feature: body-trace, Property 6: Symptom Signal schema conformance
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generate, validate } from "../symptom-signal-generator";
import type { PainMarker, SymptomDescriptor } from "@bodytrace/shared";

/**
 * Validates: Requirements 3.2, 3.3
 *
 * Property 6: Symptom Signal schema conformance
 * For any generated Symptom Signal, it must validate against the documented
 * JSON schema — including non-null anatomical region, valid pain type,
 * intensity in 0–10, valid frequency, valid duration, and a valid timestamp.
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

const regionIdArb = fc.string({ minLength: 1 });
const regionNameArb = fc.string({ minLength: 1 });

const coordinatesArb = fc.record({
  x: fc.float(),
  y: fc.float(),
  z: fc.float(),
});

describe("Property 6: Symptom Signal schema conformance", () => {
  it("should validate against the JSON schema for any generated signal", () => {
    fc.assert(
      fc.property(
        painTypeArb,
        intensityArb,
        frequencyArb,
        durationArb,
        regionIdArb,
        regionNameArb,
        coordinatesArb,
        (painType, intensity, frequency, duration, regionId, regionName, coordinates) => {
          const marker: PainMarker = {
            id: `marker-${regionId}`,
            sessionId: "session-1",
            location: {
              region: {
                id: regionId,
                name: regionName,
                bodySystem: "musculoskeletal",
              },
              coordinates,
            },
            intensity,
            createdAt: new Date(),
            status: "active",
          };

          const descriptor: SymptomDescriptor = {
            id: `desc-${regionId}`,
            markerId: marker.id,
            painType,
            intensity,
            frequency,
            duration,
            followUpResponses: [],
            completedAt: new Date(),
          };

          const signal = generate(marker, descriptor);
          const result = validate(signal);

          expect(result).toEqual({ valid: true });
        }
      ),
      { numRuns: 20 }
    );
  });
});
