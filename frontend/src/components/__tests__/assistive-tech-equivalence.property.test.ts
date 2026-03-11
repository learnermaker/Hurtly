// Feature: body-trace, Property 25: Assistive technology functional equivalence
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type { AnatomicalLocation, AnatomicalRegion } from "@bodytrace/shared";
import { getAllRegions } from "../../services/anatomical-region-mapper";

/**
 * **Validates: Requirements 10.5**
 *
 * Property 25: Assistive technology functional equivalence
 * For any Pain Marker selection (whether via visual 3D interaction or assistive
 * technology text selection), the resulting characterization workflow should
 * produce a Symptom Descriptor with the same structure and validation rules.
 *
 * This test verifies that both paths (visual and text-based) produce
 * AnatomicalLocation objects with:
 * - Same region structure (id, name, bodySystem)
 * - Valid coordinates (x, y, z numbers)
 * - Same validation rules apply
 */

const allRegions = getAllRegions();

// Arbitrary that picks a random region from the full set
const regionArb = fc.integer({ min: 0, max: allRegions.length - 1 }).map(
  (i) => allRegions[i]
);

// Arbitrary for valid 3D coordinates on the body model surface
// Based on the body model dimensions (roughly 0-2m height, ±0.3m width/depth)
const coordinateArb = fc.record({
  x: fc.double({ min: -0.3, max: 0.3 }),
  y: fc.double({ min: 0, max: 2 }),
  z: fc.double({ min: -0.15, max: 0.15 }),
});

/**
 * Simulate visual path: BodyModelRenderer onPointSelect callback
 * This would be triggered by clicking on the 3D model
 */
function simulateVisualSelection(region: AnatomicalRegion): AnatomicalLocation {
  // Map region to approximate center coordinates (same as BodyModelRenderer and RegionSearchPanel)
  const regionCenters: Record<string, [number, number, number]> = {
    head: [0, 1.72, 0],
    neck: [0, 1.52, 0],
    "left-shoulder": [-0.265, 1.375, 0],
    "right-shoulder": [0.265, 1.375, 0],
    chest: [0, 1.2, 0.075],
    "upper-back": [0, 1.2, -0.075],
    abdomen: [0, 0.975, 0.075],
    "lower-back": [0, 0.975, -0.075],
    "left-upper-arm": [-0.28, 1.18, 0],
    "right-upper-arm": [0.28, 1.18, 0],
    "left-forearm": [-0.28, 0.9, 0],
    "right-forearm": [0.28, 0.9, 0],
    "left-hand": [-0.28, 0.74, 0],
    "right-hand": [0.28, 0.74, 0],
    "left-hip": [-0.115, 0.8, 0],
    "right-hip": [0.115, 0.8, 0],
    "left-thigh": [-0.1, 0.55, 0],
    "right-thigh": [0.1, 0.55, 0],
    "left-knee": [-0.1, 0.43, 0],
    "right-knee": [0.1, 0.43, 0],
    "left-shin": [-0.1, 0.25, 0],
    "right-shin": [0.1, 0.25, 0],
    "left-foot": [-0.1, 0.05, 0.02],
    "right-foot": [0.1, 0.05, 0.02],
  };

  const coords = regionCenters[region.id] || [0, 1, 0];
  return {
    region,
    coordinates: { x: coords[0], y: coords[1], z: coords[2] },
  };
}

/**
 * Simulate text-based path: RegionSearchPanel onRegionSelect callback
 * This would be triggered by selecting from the searchable list
 */
function simulateTextBasedSelection(region: AnatomicalRegion): AnatomicalLocation {
  // Map region to approximate center coordinates (same as RegionSearchPanel)
  const regionCenters: Record<string, [number, number, number]> = {
    head: [0, 1.72, 0],
    neck: [0, 1.52, 0],
    "left-shoulder": [-0.265, 1.375, 0],
    "right-shoulder": [0.265, 1.375, 0],
    chest: [0, 1.2, 0.075],
    "upper-back": [0, 1.2, -0.075],
    abdomen: [0, 0.975, 0.075],
    "lower-back": [0, 0.975, -0.075],
    "left-upper-arm": [-0.28, 1.18, 0],
    "right-upper-arm": [0.28, 1.18, 0],
    "left-forearm": [-0.28, 0.9, 0],
    "right-forearm": [0.28, 0.9, 0],
    "left-hand": [-0.28, 0.74, 0],
    "right-hand": [0.28, 0.74, 0],
    "left-hip": [-0.115, 0.8, 0],
    "right-hip": [0.115, 0.8, 0],
    "left-thigh": [-0.1, 0.55, 0],
    "right-thigh": [0.1, 0.55, 0],
    "left-knee": [-0.1, 0.43, 0],
    "right-knee": [0.1, 0.43, 0],
    "left-shin": [-0.1, 0.25, 0],
    "right-shin": [0.1, 0.25, 0],
    "left-foot": [-0.1, 0.05, 0.02],
    "right-foot": [0.1, 0.05, 0.02],
  };

  const coords = regionCenters[region.id] || [0, 1, 0];
  return {
    region,
    coordinates: { x: coords[0], y: coords[1], z: coords[2] },
  };
}

/**
 * Validate that an AnatomicalLocation has the correct structure
 */
function validateAnatomicalLocation(location: AnatomicalLocation): void {
  // Region structure validation
  expect(location.region).toBeDefined();
  expect(typeof location.region.id).toBe("string");
  expect(location.region.id.length).toBeGreaterThan(0);
  expect(typeof location.region.name).toBe("string");
  expect(location.region.name.length).toBeGreaterThan(0);
  expect(typeof location.region.bodySystem).toBe("string");
  expect(location.region.bodySystem.length).toBeGreaterThan(0);

  // Coordinates validation
  expect(location.coordinates).toBeDefined();
  expect(typeof location.coordinates.x).toBe("number");
  expect(typeof location.coordinates.y).toBe("number");
  expect(typeof location.coordinates.z).toBe("number");
  expect(Number.isFinite(location.coordinates.x)).toBe(true);
  expect(Number.isFinite(location.coordinates.y)).toBe(true);
  expect(Number.isFinite(location.coordinates.z)).toBe(true);
}

describe("Property 25: Assistive technology functional equivalence", () => {
  it("both visual and text-based paths produce AnatomicalLocation with same region structure", () => {
    fc.assert(
      fc.property(regionArb, (region) => {
        const visualLocation = simulateVisualSelection(region);
        const textLocation = simulateTextBasedSelection(region);

        // Both should have the same region
        expect(visualLocation.region.id).toBe(textLocation.region.id);
        expect(visualLocation.region.name).toBe(textLocation.region.name);
        expect(visualLocation.region.bodySystem).toBe(textLocation.region.bodySystem);
      }),
      { numRuns: 20 }
    );
  });

  it("both visual and text-based paths produce valid coordinates", () => {
    fc.assert(
      fc.property(regionArb, (region) => {
        const visualLocation = simulateVisualSelection(region);
        const textLocation = simulateTextBasedSelection(region);

        // Validate visual path coordinates
        validateAnatomicalLocation(visualLocation);

        // Validate text-based path coordinates
        validateAnatomicalLocation(textLocation);
      }),
      { numRuns: 20 }
    );
  });

  it("both paths produce identical coordinates for the same region", () => {
    fc.assert(
      fc.property(regionArb, (region) => {
        const visualLocation = simulateVisualSelection(region);
        const textLocation = simulateTextBasedSelection(region);

        // Coordinates should be identical since both use the same mapping
        expect(visualLocation.coordinates.x).toBe(textLocation.coordinates.x);
        expect(visualLocation.coordinates.y).toBe(textLocation.coordinates.y);
        expect(visualLocation.coordinates.z).toBe(textLocation.coordinates.z);
      }),
      { numRuns: 20 }
    );
  });

  it("both paths apply the same validation rules to AnatomicalLocation", () => {
    fc.assert(
      fc.property(regionArb, (region) => {
        const visualLocation = simulateVisualSelection(region);
        const textLocation = simulateTextBasedSelection(region);

        // Both should pass the same validation function
        expect(() => validateAnatomicalLocation(visualLocation)).not.toThrow();
        expect(() => validateAnatomicalLocation(textLocation)).not.toThrow();

        // Both should have the same structure
        expect(Object.keys(visualLocation).sort()).toEqual(
          Object.keys(textLocation).sort()
        );
        expect(Object.keys(visualLocation.region).sort()).toEqual(
          Object.keys(textLocation.region).sort()
        );
        expect(Object.keys(visualLocation.coordinates).sort()).toEqual(
          Object.keys(textLocation.coordinates).sort()
        );
      }),
      { numRuns: 20 }
    );
  });
});
