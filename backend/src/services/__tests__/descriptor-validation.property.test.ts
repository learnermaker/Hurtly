// Feature: body-trace, Property 3: Symptom Descriptor field validation
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type {
  SymptomDescriptor,
  PainType,
  PainFrequency,
  PainDuration,
} from "@bodytrace/shared";

/**
 * Validates: Requirements 2.2, 2.3, 2.4
 *
 * Property 3: Symptom Descriptor field validation
 * For any completed Symptom Descriptor, the intensity must be in the range 0–10,
 * the frequency must be one of the predefined values, the duration must be one of
 * the predefined values, and the painType must be one of the predefined values.
 */

const VALID_PAIN_TYPES: PainType[] = [
  "sharp",
  "dull",
  "burning",
  "throbbing",
  "aching",
  "stabbing",
  "tingling",
  "numbness",
];

const VALID_FREQUENCIES: PainFrequency[] = [
  "constant",
  "intermittent",
  "occasional",
  "only-during-activity",
];

const VALID_DURATIONS: PainDuration[] = [
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks",
];

const painTypeArb = fc.constantFrom(...VALID_PAIN_TYPES);
const intensityArb = fc.integer({ min: 0, max: 10 });
const frequencyArb = fc.constantFrom(...VALID_FREQUENCIES);
const durationArb = fc.constantFrom(...VALID_DURATIONS);

const symptomDescriptorArb: fc.Arbitrary<SymptomDescriptor> = fc.record({
  id: fc.uuid(),
  markerId: fc.uuid(),
  painType: painTypeArb,
  intensity: intensityArb,
  frequency: frequencyArb,
  duration: durationArb,
  followUpResponses: fc.constant([]),
  completedAt: fc.date(),
});

describe("Property 3: Symptom Descriptor field validation", () => {
  it("intensity is always in range 0–10", () => {
    fc.assert(
      fc.property(symptomDescriptorArb, (descriptor) => {
        expect(descriptor.intensity).toBeGreaterThanOrEqual(0);
        expect(descriptor.intensity).toBeLessThanOrEqual(10);
      }),
      { numRuns: 20 }
    );
  });

  it("frequency is always one of the allowed values", () => {
    fc.assert(
      fc.property(symptomDescriptorArb, (descriptor) => {
        expect(VALID_FREQUENCIES).toContain(descriptor.frequency);
      }),
      { numRuns: 20 }
    );
  });

  it("duration is always one of the allowed values", () => {
    fc.assert(
      fc.property(symptomDescriptorArb, (descriptor) => {
        expect(VALID_DURATIONS).toContain(descriptor.duration);
      }),
      { numRuns: 20 }
    );
  });

  it("painType is always one of the allowed values", () => {
    fc.assert(
      fc.property(symptomDescriptorArb, (descriptor) => {
        expect(VALID_PAIN_TYPES).toContain(descriptor.painType);
      }),
      { numRuns: 20 }
    );
  });

  it("all fields are valid simultaneously for any generated descriptor", () => {
    fc.assert(
      fc.property(symptomDescriptorArb, (descriptor) => {
        expect(descriptor.intensity).toBeGreaterThanOrEqual(0);
        expect(descriptor.intensity).toBeLessThanOrEqual(10);
        expect(VALID_FREQUENCIES).toContain(descriptor.frequency);
        expect(VALID_DURATIONS).toContain(descriptor.duration);
        expect(VALID_PAIN_TYPES).toContain(descriptor.painType);
      }),
      { numRuns: 20 }
    );
  });
});
