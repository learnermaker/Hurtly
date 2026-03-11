// Feature: body-trace, Property 13: Timeline chronological ordering
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { SymptomTimelineServiceImpl } from "../symptom-timeline-service";
import type {
  AnatomicalRegion,
  TimelineData,
  PainType,
} from "../../../../shared/src/types";

/**
 * Validates: Requirements 6.1, 6.2
 *
 * Property 13: Timeline chronological ordering
 * For any anatomical region with recorded symptoms, the Symptom Timeline entries
 * should be sorted in ascending chronological order, and each entry should contain
 * a valid intensity value and timestamp.
 */

// --- Arbitraries ---

const painTypeArb: fc.Arbitrary<PainType> = fc.constantFrom(
  "sharp",
  "dull",
  "burning",
  "throbbing",
  "aching",
  "stabbing",
  "tingling",
  "numbness"
);

const intensityArb = fc.integer({ min: 0, max: 10 });

const validDateArb = fc.integer({
  min: new Date("2020-01-01").getTime(),
  max: new Date("2030-01-01").getTime(),
}).map((ts) => new Date(ts));

const regionArb: fc.Arbitrary<AnatomicalRegion> = fc.record({
  id: fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/),
  name: fc.stringMatching(/^[A-Z][a-zA-Z ]{0,29}$/),
  bodySystem: fc.constant("musculoskeletal"),
});

// Generate a single timeline entry (database row)
const timelineRowArb = fc.record({
  date: validDateArb,
  intensity: intensityArb,
  pain_type: painTypeArb,
  marker_id: fc.stringMatching(/^m-[a-z0-9]{1,10}$/),
});

// Generate 1-20 timeline entries
const timelineRowsArb = fc.array(timelineRowArb, { minLength: 1, maxLength: 20 });

// --- Mock Pool ---

/**
 * Creates a mock database pool that returns the provided rows
 * when queried for timeline data
 */
function createMockPool(rows: any[]) {
  return {
    query: async (sql: string, params?: any[]) => {
      // Return rows sorted by date (as the SQL query does)
      const sortedRows = [...rows].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      return { rows: sortedRows };
    },
  } as any;
}

// --- Test ---

describe("Property 13: Timeline chronological ordering", () => {
  it("should return entries in ascending chronological order with valid intensity and timestamp", async () => {
    await fc.assert(
      fc.asyncProperty(
        regionArb,
        timelineRowsArb,
        async (region, rows) => {
          const mockPool = createMockPool(rows);
          const service = new SymptomTimelineServiceImpl(mockPool);

          const timeline: TimelineData = await service.getTimeline(
            "test-user",
            region
          );

          // Property 1: Verify entries are in ascending chronological order
          for (let i = 1; i < timeline.entries.length; i++) {
            const prevDate = timeline.entries[i - 1].date.getTime();
            const currDate = timeline.entries[i].date.getTime();
            expect(currDate).toBeGreaterThanOrEqual(prevDate);
          }

          // Property 2: Verify each entry has a valid intensity (0-10)
          for (const entry of timeline.entries) {
            expect(entry.intensity).toBeGreaterThanOrEqual(0);
            expect(entry.intensity).toBeLessThanOrEqual(10);
            expect(Number.isInteger(entry.intensity)).toBe(true);
          }

          // Property 3: Verify each entry has a non-null timestamp
          for (const entry of timeline.entries) {
            expect(entry.date).toBeInstanceOf(Date);
            expect(entry.date.getTime()).not.toBeNaN();
          }

          // Property 4: Verify entry count matches input
          expect(timeline.entries.length).toBe(rows.length);

          // Property 5: Verify region is preserved
          expect(timeline.region).toEqual(region);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should handle empty timeline data", async () => {
    await fc.assert(
      fc.asyncProperty(regionArb, async (region) => {
        const mockPool = createMockPool([]);
        const service = new SymptomTimelineServiceImpl(mockPool);

        const timeline: TimelineData = await service.getTimeline(
          "test-user",
          region
        );

        expect(timeline.entries).toHaveLength(0);
        expect(timeline.region).toEqual(region);
      }),
      { numRuns: 20 }
    );
  });

  it("should handle single entry timeline", async () => {
    await fc.assert(
      fc.asyncProperty(
        regionArb,
        timelineRowArb,
        async (region, row) => {
          const mockPool = createMockPool([row]);
          const service = new SymptomTimelineServiceImpl(mockPool);

          const timeline: TimelineData = await service.getTimeline(
            "test-user",
            region
          );

          expect(timeline.entries).toHaveLength(1);
          expect(timeline.entries[0].intensity).toBeGreaterThanOrEqual(0);
          expect(timeline.entries[0].intensity).toBeLessThanOrEqual(10);
          expect(timeline.entries[0].date).toBeInstanceOf(Date);
          expect(timeline.entries[0].date.getTime()).not.toBeNaN();
        }
      ),
      { numRuns: 20 }
    );
  });
});
