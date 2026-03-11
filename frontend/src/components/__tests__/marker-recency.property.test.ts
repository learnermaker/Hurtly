// Feature: body-trace, Property 11: Marker recency classification
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { classifyRecency } from "../BodyModelRenderer";
import type { PainMarker, AnatomicalLocation } from "@bodytrace/shared";

/**
 * Validates: Requirements 5.3
 *
 * Property 11: Marker recency classification
 * For any Pain Marker with a known creation date and status, the recency
 * classification function should deterministically assign one of "active",
 * "resolved", or "historical", and markers with the same status should
 * receive the same classification.
 */

const VALID_STATUSES = ["active", "resolved", "historical"] as const;

// Arbitrary for marker status
const statusArb = fc.constantFrom(...VALID_STATUSES);

// Arbitrary for a random date
const dateArb = fc.date({ min: new Date("2000-01-01"), max: new Date("2030-12-31") });

// Minimal anatomical location for constructing a PainMarker
const locationArb: fc.Arbitrary<AnatomicalLocation> = fc.record({
  region: fc.record({
    id: fc.constant("test-region"),
    name: fc.constant("Test Region"),
    bodySystem: fc.constant("musculoskeletal"),
  }),
  coordinates: fc.record({
    x: fc.float({ min: -1, max: 1, noNaN: true }),
    y: fc.float({ min: -1, max: 1, noNaN: true }),
    z: fc.float({ min: -1, max: 1, noNaN: true }),
  }),
});

// Arbitrary for a PainMarker with random status and date
const painMarkerArb: fc.Arbitrary<PainMarker> = fc.record({
  id: fc.uuid(),
  sessionId: fc.uuid(),
  location: locationArb,
  intensity: fc.integer({ min: 0, max: 10 }),
  createdAt: dateArb,
  status: statusArb,
});

describe("Property 11: Marker recency classification", () => {
  it("should return one of the three valid classification values", () => {
    fc.assert(
      fc.property(painMarkerArb, (marker) => {
        const result = classifyRecency(marker);
        expect(VALID_STATUSES).toContain(result);
      }),
      { numRuns: 20 }
    );
  });

  it("should be deterministic: same marker always produces the same classification", () => {
    fc.assert(
      fc.property(painMarkerArb, (marker) => {
        const result1 = classifyRecency(marker);
        const result2 = classifyRecency(marker);
        expect(result1).toBe(result2);
      }),
      { numRuns: 20 }
    );
  });

  it("markers with the same status should receive the same classification", () => {
    fc.assert(
      fc.property(painMarkerArb, painMarkerArb, (markerA, markerB) => {
        // Force same status on both markers
        const sharedStatus = markerA.status;
        const markerBSameStatus = { ...markerB, status: sharedStatus };

        const resultA = classifyRecency(markerA);
        const resultB = classifyRecency(markerBSameStatus);
        expect(resultA).toBe(resultB);
      }),
      { numRuns: 20 }
    );
  });
});
