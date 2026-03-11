// Feature: body-trace, Property 14: Timeline symptom status tracking
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { SymptomTimelineServiceImpl } from "../symptom-timeline-service";
import type {
  AnatomicalRegion,
  TimelineData,
  PainType,
} from "../../../../shared/src/types";

/**
 * Validates: Requirements 6.3
 *
 * Property 14: Timeline symptom status tracking
 * For any timeline, the first occurrence of a symptom in a region should be
 * marked as "appeared", and when a symptom is no longer reported, it should
 * be marked as "resolved". Intermediate occurrences should be marked as "active".
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

// Generate 1-30 timeline entries
const timelineRowsArb = fc.array(timelineRowArb, { minLength: 1, maxLength: 30 });

// --- Mock Pool ---

/**
 * Creates a mock database pool that returns the provided rows
 * when queried for timeline data
 */
function createMockPool(rows: any[]) {
  return {
    query: async () => {
      // Return rows sorted by date (as the SQL query does)
      const sortedRows = [...rows].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      return { rows: sortedRows };
    },
  } as any;
}

// --- Test ---

describe("Property 14: Timeline symptom status tracking", () => {
  it("should mark first occurrence as 'appeared' and last occurrence as 'resolved' when symptom stops", async () => {
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

          // Track first and last occurrence of each pain type
          const firstOccurrence = new Map<PainType, number>();
          const lastOccurrence = new Map<PainType, number>();

          timeline.entries.forEach((entry, index) => {
            if (!firstOccurrence.has(entry.painType)) {
              firstOccurrence.set(entry.painType, index);
            }
            lastOccurrence.set(entry.painType, index);
          });

          // Property 1: First occurrence of each pain type should be marked "appeared"
          firstOccurrence.forEach((index, painType) => {
            const entry = timeline.entries[index];
            expect(entry.painType).toBe(painType);
            
            // First occurrence should be "appeared" unless it's also the last and not final
            const isLast = lastOccurrence.get(painType) === index;
            const isFinal = index === timeline.entries.length - 1;
            
            if (isLast && !isFinal) {
              // Single occurrence that's not at the end gets marked "resolved"
              expect(entry.status).toBe("resolved");
            } else {
              expect(entry.status).toBe("appeared");
            }
          });

          // Property 2: Last occurrence should be marked "resolved" if it's not the final entry
          const finalIndex = timeline.entries.length - 1;
          lastOccurrence.forEach((index, painType) => {
            const entry = timeline.entries[index];
            const isFirst = firstOccurrence.get(painType) === index;
            
            if (index < finalIndex) {
              // This pain type stopped appearing before the end
              expect(entry.status).toBe("resolved");
            } else {
              // This pain type continues to the end
              if (isFirst) {
                expect(entry.status).toBe("appeared");
              } else {
                expect(entry.status).toBe("active");
              }
            }
          });

          // Property 3: Intermediate occurrences (not first, not last) should be "active"
          timeline.entries.forEach((entry, index) => {
            const first = firstOccurrence.get(entry.painType)!;
            const last = lastOccurrence.get(entry.painType)!;

            if (index > first && index < last) {
              // This is an intermediate occurrence
              expect(entry.status).toBe("active");
            }
          });

          // Property 4: Each entry should have a valid status
          timeline.entries.forEach((entry) => {
            expect(["appeared", "active", "resolved"]).toContain(entry.status);
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should handle single occurrence of a pain type", async () => {
    await fc.assert(
      fc.asyncProperty(
        regionArb,
        painTypeArb,
        intensityArb,
        validDateArb,
        async (region, painType, intensity, date) => {
          const row = {
            date,
            intensity,
            pain_type: painType,
            marker_id: "m-single",
          };

          const mockPool = createMockPool([row]);
          const service = new SymptomTimelineServiceImpl(mockPool);

          const timeline: TimelineData = await service.getTimeline(
            "test-user",
            region
          );

          // Single occurrence should be marked "appeared"
          expect(timeline.entries).toHaveLength(1);
          expect(timeline.entries[0].status).toBe("appeared");
          expect(timeline.entries[0].painType).toBe(painType);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should handle multiple pain types with different lifecycles", async () => {
    // Create a specific scenario:
    // - "sharp" appears at t1, t2, t3 (continues to end) - index 0, 1, 3
    // - "burning" appears at t2, t3 (stops before end) - index 2, 5
    // - "dull" appears at t3, t4 (continues to end) - index 4, 6
    const rows = [
      { date: new Date("2024-01-01"), intensity: 5, pain_type: "sharp", marker_id: "m1" },
      { date: new Date("2024-01-02"), intensity: 6, pain_type: "sharp", marker_id: "m2" },
      { date: new Date("2024-01-02"), intensity: 4, pain_type: "burning", marker_id: "m3" },
      { date: new Date("2024-01-03"), intensity: 7, pain_type: "sharp", marker_id: "m4" },
      { date: new Date("2024-01-03"), intensity: 5, pain_type: "dull", marker_id: "m5" },
      { date: new Date("2024-01-03"), intensity: 3, pain_type: "burning", marker_id: "m6" },
      { date: new Date("2024-01-04"), intensity: 6, pain_type: "dull", marker_id: "m7" },
    ];

    const region: AnatomicalRegion = {
      id: "test-region",
      name: "Test Region",
      bodySystem: "musculoskeletal",
    };

    const mockPool = createMockPool(rows);
    const service = new SymptomTimelineServiceImpl(mockPool);

    const timeline: TimelineData = await service.getTimeline(
      "test-user",
      region
    );

    // The timeline should be sorted by date, so order is:
    // 0: sharp (t1) - first occurrence -> "appeared"
    // 1: sharp (t2) - middle -> "active"
    // 2: burning (t2) - first occurrence -> "appeared"
    // 3: sharp (t3) - last occurrence, but at final index -> "resolved" (because dull comes after)
    // 4: dull (t3) - first occurrence -> "appeared"
    // 5: burning (t3) - last occurrence, not at final index -> "resolved"
    // 6: dull (t4) - last occurrence, at final index -> "active"

    // Find entries by pain type
    const sharpEntries = timeline.entries.filter((e) => e.painType === "sharp");
    const dullEntries = timeline.entries.filter((e) => e.painType === "dull");
    const burningEntries = timeline.entries.filter((e) => e.painType === "burning");

    // Sharp: appears at indices 0, 1, 3
    // Last occurrence (index 3) is not the final entry (index 6), so it should be "resolved"
    expect(sharpEntries[0].status).toBe("appeared");
    expect(sharpEntries[1].status).toBe("active");
    expect(sharpEntries[2].status).toBe("resolved");

    // Dull: appears at indices 4, 6
    // Last occurrence (index 6) is the final entry, so it should be "active"
    expect(dullEntries[0].status).toBe("appeared");
    expect(dullEntries[1].status).toBe("active");

    // Burning: appears at indices 2, 5
    // Last occurrence (index 5) is not the final entry, so it should be "resolved"
    expect(burningEntries[0].status).toBe("appeared");
    expect(burningEntries[1].status).toBe("resolved");
  });

  it("should handle empty timeline", async () => {
    await fc.assert(
      fc.asyncProperty(regionArb, async (region) => {
        const mockPool = createMockPool([]);
        const service = new SymptomTimelineServiceImpl(mockPool);

        const timeline: TimelineData = await service.getTimeline(
          "test-user",
          region
        );

        expect(timeline.entries).toHaveLength(0);
      }),
      { numRuns: 20 }
    );
  });
});
