// Feature: body-trace, Property 12: Body Map filter correctness
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import type {
  PainMarker,
  SymptomDescriptor,
  MarkerFilter,
  PainType,
  PainFrequency,
  PainDuration,
} from "@bodytrace/shared";
import { filterMarkersInMemory } from "../body-map-service.js";

/**
 * Validates: Requirements 5.5
 *
 * Property 12: Body Map filter correctness
 * For any set of Pain Markers and any combination of filter criteria
 * (date range, pain type, intensity range, anatomical region), every marker
 * returned by the filter must satisfy all specified criteria, and no marker
 * satisfying all criteria should be excluded.
 */

// --- Arbitraries ---

const painTypeArb: fc.Arbitrary<PainType> = fc.constantFrom(
  "sharp", "dull", "burning", "throbbing",
  "aching", "stabbing", "tingling", "numbness"
);

const frequencyArb: fc.Arbitrary<PainFrequency> = fc.constantFrom(
  "constant", "intermittent", "occasional", "only-during-activity"
);

const durationArb: fc.Arbitrary<PainDuration> = fc.constantFrom(
  "seconds", "minutes", "hours", "days", "weeks"
);

const intensityArb = fc.integer({ min: 0, max: 10 });

const statusArb = fc.constantFrom(
  "active" as const, "resolved" as const, "historical" as const
);

const validDateArb = fc.integer({
  min: new Date("2020-01-01").getTime(),
  max: new Date("2030-01-01").getTime(),
}).map((ts) => new Date(ts));

const coordinatesArb = fc.record({
  x: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  z: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
});

const regionIdArb = fc.constantFrom(
  "left-shoulder", "right-shoulder", "lower-back", "upper-back",
  "left-knee", "right-knee", "chest", "neck", "head", "left-hip"
);

const regionArb = regionIdArb.map((id) => ({
  id,
  name: id.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "),
  bodySystem: "musculoskeletal",
}));

/**
 * Generate a marker with a specific index for unique IDs.
 */
function markerArb(index: number): fc.Arbitrary<PainMarker> {
  return fc.record({
    region: regionArb,
    coordinates: coordinatesArb,
    intensity: intensityArb,
    status: statusArb,
    createdAt: validDateArb,
  }).map((data) => ({
    id: `marker-${index}`,
    sessionId: "session-filter-test",
    location: { region: data.region, coordinates: data.coordinates },
    intensity: data.intensity,
    createdAt: data.createdAt,
    status: data.status,
  }));
}

/**
 * Generate a descriptor linked to a marker.
 */
function descriptorForMarker(marker: PainMarker): fc.Arbitrary<SymptomDescriptor> {
  return fc.record({
    painType: painTypeArb,
    intensity: intensityArb,
    frequency: frequencyArb,
    duration: durationArb,
    completedAt: validDateArb,
  }).map((data) => ({
    id: `desc-${marker.id}`,
    markerId: marker.id,
    painType: data.painType,
    intensity: data.intensity,
    frequency: data.frequency,
    duration: data.duration,
    followUpResponses: [],
    completedAt: data.completedAt,
  }));
}

/**
 * Generate a set of 5-20 markers with matching descriptors.
 */
const markersWithDescriptorsArb = fc
  .integer({ min: 5, max: 20 })
  .chain((count) => {
    const markerArbs = Array.from({ length: count }, (_, i) => markerArb(i));
    return fc.tuple(...markerArbs).chain((markers) => {
      const descArbs = markers.map((m) => descriptorForMarker(m));
      return fc.tuple(...descArbs).map((descriptors) => ({
        markers,
        descriptors,
      }));
    });
  });

/**
 * Generate random filter criteria. Each filter dimension is optionally present.
 */
const filterArb: fc.Arbitrary<MarkerFilter> = fc.record({
  dateRange: fc.option(
    fc.tuple(validDateArb, validDateArb).map(([a, b]) => {
      const start = a < b ? a : b;
      const end = a < b ? b : a;
      return { start, end };
    }),
    { nil: undefined }
  ),
  painTypes: fc.option(
    fc.uniqueArray(painTypeArb, { minLength: 1, maxLength: 4 }),
    { nil: undefined }
  ),
  intensityRange: fc.option(
    fc.tuple(intensityArb, intensityArb).map(([a, b]) => ({
      min: Math.min(a, b),
      max: Math.max(a, b),
    })),
    { nil: undefined }
  ),
  regions: fc.option(
    fc.uniqueArray(regionIdArb, { minLength: 1, maxLength: 4 }),
    { nil: undefined }
  ),
});

/**
 * Reference implementation: check if a single marker satisfies ALL filter criteria.
 */
function markerSatisfiesFilter(
  marker: PainMarker,
  descriptor: SymptomDescriptor | undefined,
  filters: MarkerFilter
): boolean {
  if (filters.dateRange) {
    const created = marker.createdAt.getTime();
    if (created < filters.dateRange.start.getTime() || created > filters.dateRange.end.getTime()) {
      return false;
    }
  }

  if (filters.painTypes && filters.painTypes.length > 0) {
    if (!descriptor || !filters.painTypes.includes(descriptor.painType)) {
      return false;
    }
  }

  if (filters.intensityRange) {
    if (marker.intensity < filters.intensityRange.min || marker.intensity > filters.intensityRange.max) {
      return false;
    }
  }

  if (filters.regions && filters.regions.length > 0) {
    if (!filters.regions.includes(marker.location.region.id)) {
      return false;
    }
  }

  return true;
}

// --- Tests ---

describe("Property 12: Body Map filter correctness", () => {
  it("every returned marker satisfies ALL filter criteria", () => {
    fc.assert(
      fc.property(markersWithDescriptorsArb, filterArb, ({ markers, descriptors }, filters) => {
        const descriptorByMarkerId = new Map(descriptors.map((d) => [d.markerId, d]));
        const result = filterMarkersInMemory(markers, descriptors, filters);

        for (const marker of result) {
          const desc = descriptorByMarkerId.get(marker.id);

          if (filters.dateRange) {
            const created = marker.createdAt.getTime();
            expect(created).toBeGreaterThanOrEqual(filters.dateRange.start.getTime());
            expect(created).toBeLessThanOrEqual(filters.dateRange.end.getTime());
          }

          if (filters.painTypes && filters.painTypes.length > 0) {
            expect(desc).toBeDefined();
            expect(filters.painTypes).toContain(desc!.painType);
          }

          if (filters.intensityRange) {
            expect(marker.intensity).toBeGreaterThanOrEqual(filters.intensityRange.min);
            expect(marker.intensity).toBeLessThanOrEqual(filters.intensityRange.max);
          }

          if (filters.regions && filters.regions.length > 0) {
            expect(filters.regions).toContain(marker.location.region.id);
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it("no marker satisfying all criteria is excluded from results", () => {
    fc.assert(
      fc.property(markersWithDescriptorsArb, filterArb, ({ markers, descriptors }, filters) => {
        const descriptorByMarkerId = new Map(descriptors.map((d) => [d.markerId, d]));
        const result = filterMarkersInMemory(markers, descriptors, filters);
        const resultIds = new Set(result.map((m) => m.id));

        for (const marker of markers) {
          const desc = descriptorByMarkerId.get(marker.id);
          if (markerSatisfiesFilter(marker, desc, filters)) {
            expect(resultIds.has(marker.id)).toBe(true);
          }
        }
      }),
      { numRuns: 20 }
    );
  });

  it("result count equals the number of markers satisfying all criteria", () => {
    fc.assert(
      fc.property(markersWithDescriptorsArb, filterArb, ({ markers, descriptors }, filters) => {
        const descriptorByMarkerId = new Map(descriptors.map((d) => [d.markerId, d]));
        const result = filterMarkersInMemory(markers, descriptors, filters);

        const expectedCount = markers.filter((m) =>
          markerSatisfiesFilter(m, descriptorByMarkerId.get(m.id), filters)
        ).length;

        expect(result.length).toBe(expectedCount);
      }),
      { numRuns: 20 }
    );
  });
});
