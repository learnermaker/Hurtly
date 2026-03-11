// Feature: body-trace, Property 1: Anatomical region resolution
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { resolve } from "../anatomical-region-mapper";

/**
 * Validates: Requirements 1.4
 *
 * Property 1: Anatomical region resolution
 * For any valid 3D coordinate on the body model surface, the Anatomical
 * Region Mapper should return a non-empty, named anatomical region.
 */

// Generator for 3D coordinates within the body model's approximate bounds
const bodyCoordinateArb = fc.record({
  x: fc.double({ min: -0.7, max: 0.7, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: 0.0, max: 1.9, noNaN: true, noDefaultInfinity: true }),
  z: fc.double({ min: -0.15, max: 0.15, noNaN: true, noDefaultInfinity: true }),
});

describe("Property 1: Anatomical region resolution", () => {
  it("should return a non-empty named region for any valid 3D coordinate on the body model", () => {
    fc.assert(
      fc.property(bodyCoordinateArb, (point) => {
        const region = resolve(point);

        // Region must have a non-empty id
        expect(region.id).toBeDefined();
        expect(typeof region.id).toBe("string");
        expect(region.id.length).toBeGreaterThan(0);

        // Region must have a non-empty name
        expect(region.name).toBeDefined();
        expect(typeof region.name).toBe("string");
        expect(region.name.length).toBeGreaterThan(0);

        // Region must have a non-empty bodySystem
        expect(region.bodySystem).toBeDefined();
        expect(typeof region.bodySystem).toBe("string");
        expect(region.bodySystem.length).toBeGreaterThan(0);
      }),
      { numRuns: 20 }
    );
  });
});
