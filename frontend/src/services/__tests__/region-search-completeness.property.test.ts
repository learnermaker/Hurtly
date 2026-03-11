// Feature: body-trace, Property 24: Anatomical region search completeness
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getAllRegions, searchRegions } from "../anatomical-region-mapper";

/**
 * Validates: Requirements 10.2
 *
 * Property 24: Anatomical region search completeness
 * For each region in the system, searching by its exact name should return it
 * in the results. For any query, all returned regions should contain the query
 * string (case-insensitive) in their name.
 */

const allRegions = getAllRegions();

// Arbitrary that picks a random region from the full set
const regionArb = fc.integer({ min: 0, max: allRegions.length - 1 }).map(
  (i) => allRegions[i]
);

// Arbitrary for random query strings (reasonable length)
const queryArb = fc.string({ minLength: 1, maxLength: 20 });

describe("Property 24: Anatomical region search completeness", () => {
  it("searching by a region's exact name should return that region in results", () => {
    fc.assert(
      fc.property(regionArb, (region) => {
        const results = searchRegions(region.name);
        const resultIds = results.map((r) => r.id);

        expect(resultIds).toContain(region.id);
      }),
      { numRuns: 20 }
    );
  });

  it("all returned regions should contain the query string (case-insensitive) in their name", () => {
    fc.assert(
      fc.property(queryArb, (query) => {
        const results = searchRegions(query);
        const lowerQuery = query.toLowerCase();

        for (const region of results) {
          expect(region.name.toLowerCase()).toContain(lowerQuery);
        }
      }),
      { numRuns: 20 }
    );
  });
});
