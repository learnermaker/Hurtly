// Feature: body-trace, Property 8: Follow-Up Engine generates at least one question
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generateQuestions } from "../follow-up-engine";
import type {
  SymptomDescriptor,
  PainType,
  PainFrequency,
  PainDuration,
} from "@bodytrace/shared";

/**
 * Validates: Requirements 4.1
 *
 * Property 8: Follow-Up Engine generates at least one question
 * For any completed Symptom Descriptor with a valid pain type and anatomical
 * region, the Follow-Up Engine should return at least one follow-up question.
 */

const painTypeArb = fc.constantFrom<PainType>(
  "sharp",
  "dull",
  "burning",
  "throbbing",
  "aching",
  "stabbing",
  "tingling",
  "numbness"
);

const frequencyArb = fc.constantFrom<PainFrequency>(
  "constant",
  "intermittent",
  "occasional",
  "only-during-activity"
);

const durationArb = fc.constantFrom<PainDuration>(
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks"
);

const intensityArb = fc.integer({ min: 0, max: 10 });

const descriptorArb = fc.record({
  painType: painTypeArb,
  intensity: intensityArb,
  frequency: frequencyArb,
  duration: durationArb,
}).map(
  (fields): SymptomDescriptor => ({
    id: `desc-${fc.stringify(fields)}`,
    markerId: `marker-${fc.stringify(fields)}`,
    painType: fields.painType,
    intensity: fields.intensity,
    frequency: fields.frequency,
    duration: fields.duration,
    followUpResponses: [],
    completedAt: new Date(),
  })
);

describe("Property 8: Follow-Up Engine generates at least one question", () => {
  it("should return at least one question for any valid descriptor", () => {
    fc.assert(
      fc.property(descriptorArb, (descriptor) => {
        const questions = generateQuestions(descriptor);

        // At least one question must be returned
        expect(questions.length).toBeGreaterThanOrEqual(1);

        // Every question must have a non-empty id and text
        for (const q of questions) {
          expect(q.id).toBeDefined();
          expect(typeof q.id).toBe("string");
          expect(q.id.length).toBeGreaterThan(0);

          expect(q.text).toBeDefined();
          expect(typeof q.text).toBe("string");
          expect(q.text.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 20 }
    );
  });
});
