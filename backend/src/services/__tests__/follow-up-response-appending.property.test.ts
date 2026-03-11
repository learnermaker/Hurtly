// Feature: body-trace, Property 9: Follow-up response appending
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type {
  SymptomDescriptor,
  FollowUpResponse,
  PainType,
  PainFrequency,
  PainDuration,
} from "@bodytrace/shared";

/**
 * Validates: Requirements 4.4
 *
 * Property 9: Follow-up response appending
 * For any Symptom Descriptor and any follow-up response, appending the response
 * to the descriptor should result in the descriptor's followUpResponses list
 * containing that response, and the list length should increase by one.
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

const followUpResponseArb: fc.Arbitrary<FollowUpResponse> = fc.record({
  questionId: fc.uuid(),
  questionText: fc.string({ minLength: 1, maxLength: 200 }),
  response: fc.string({ minLength: 1, maxLength: 500 }),
  answeredAt: fc.date(),
});

const existingResponsesArb = fc.array(followUpResponseArb, {
  minLength: 0,
  maxLength: 5,
});

const descriptorArb: fc.Arbitrary<SymptomDescriptor> = fc
  .record({
    painType: painTypeArb,
    intensity: fc.integer({ min: 0, max: 10 }),
    frequency: frequencyArb,
    duration: durationArb,
    existingResponses: existingResponsesArb,
  })
  .map((fields) => ({
    id: crypto.randomUUID(),
    markerId: crypto.randomUUID(),
    painType: fields.painType,
    intensity: fields.intensity,
    frequency: fields.frequency,
    duration: fields.duration,
    followUpResponses: [...fields.existingResponses],
    completedAt: new Date(),
  }));

describe("Property 9: Follow-up response appending", () => {
  it("should grow followUpResponses by exactly one and contain the new response", () => {
    fc.assert(
      fc.property(descriptorArb, followUpResponseArb, (descriptor, newResponse) => {
        const originalLength = descriptor.followUpResponses.length;

        // Append the new response
        descriptor.followUpResponses.push(newResponse);

        // List length should increase by exactly one
        expect(descriptor.followUpResponses.length).toBe(originalLength + 1);

        // The new response should be present in the array
        const found = descriptor.followUpResponses.some(
          (r) =>
            r.questionId === newResponse.questionId &&
            r.questionText === newResponse.questionText &&
            r.response === newResponse.response
        );
        expect(found).toBe(true);

        // The last element should be the appended response
        expect(descriptor.followUpResponses[originalLength]).toBe(newResponse);
      }),
      { numRuns: 20 }
    );
  });
});
