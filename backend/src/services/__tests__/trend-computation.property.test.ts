// Feature: body-trace, Property 15: Trend computation for extended timelines
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { SymptomTimelineServiceImpl } from "../symptom-timeline-service";
import type {
  AnatomicalRegion,
  TimelineData,
  TimelineEntry,
  PainType,
  Trend,
} from "../../../../shared/src/types";

/**
 * Validates: Requirements 6.4
 *
 * Property 15: Trend computation for extended timelines
 * For any timeline data spanning more than 7 days, the trend computation function
 * should return a non-null trend value (worsening, improving, or stable), and the
 * trend should be consistent with the direction of intensity changes in the data.
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

const regionArb: fc.Arbitrary<AnatomicalRegion> = fc.record({
  id: fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/),
  name: fc.stringMatching(/^[A-Z][a-zA-Z ]{0,29}$/),
  bodySystem: fc.constant("musculoskeletal"),
});

/**
 * Generate timeline data spanning > 7 days
 * Creates entries spread across at least 8 days
 */
const extendedTimelineDataArb: fc.Arbitrary<TimelineData> = fc
  .tuple(
    regionArb,
    fc.integer({ min: 5, max: 30 }), // Number of entries
    fc.integer({ min: 8, max: 30 }), // Day span (> 7 days)
    fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2028-01-01").getTime() }) // Start date timestamp
  )
  .chain(([region, numEntries, daySpan, startTimestamp]) => {
    const startDate = new Date(startTimestamp);
    // Generate entries distributed across the time span
    // Ensure first and last entries span the full range
    const entriesArb = fc.array(
      fc.record({
        // Distribute dates across the span
        dayOffset: fc.integer({ min: 0, max: daySpan }),
        intensity: intensityArb,
        painType: painTypeArb,
        status: fc.constantFrom("appeared", "active", "resolved") as fc.Arbitrary<
          "appeared" | "active" | "resolved"
        >,
      }),
      { minLength: numEntries, maxLength: numEntries }
    );

    return entriesArb.map((entries) => {
      const timelineEntries: TimelineEntry[] = entries.map((entry, index) => {
        // Force first entry to be at day 0 and last entry to be at the end
        let dayOffset = entry.dayOffset;
        if (index === 0) dayOffset = 0;
        if (index === entries.length - 1) dayOffset = daySpan;

        return {
          date: new Date(
            startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000
          ),
          intensity: entry.intensity,
          painType: entry.painType,
          status: entry.status,
        };
      });

      // Sort by date
      timelineEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        region,
        entries: timelineEntries,
      };
    });
  });

/**
 * Generate timeline data spanning ≤ 7 days
 */
const shortTimelineDataArb: fc.Arbitrary<TimelineData> = fc
  .tuple(
    regionArb,
    fc.integer({ min: 1, max: 20 }), // Number of entries
    fc.integer({ min: 0, max: 7 }), // Day span (≤ 7 days)
    fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2028-01-01").getTime() }) // Start date timestamp
  )
  .chain(([region, numEntries, daySpan, startTimestamp]) => {
    const startDate = new Date(startTimestamp);
    const entriesArb = fc.array(
      fc.record({
        dayOffset: fc.integer({ min: 0, max: Math.max(0, daySpan) }),
        intensity: intensityArb,
        painType: painTypeArb,
        status: fc.constantFrom("appeared", "active", "resolved") as fc.Arbitrary<
          "appeared" | "active" | "resolved"
        >,
      }),
      { minLength: numEntries, maxLength: numEntries }
    );

    return entriesArb.map((entries) => {
      const timelineEntries: TimelineEntry[] = entries.map((entry, index) => {
        // For multi-entry timelines with daySpan > 0, ensure first and last span the range
        let dayOffset = entry.dayOffset;
        if (daySpan > 0 && entries.length > 1) {
          if (index === 0) dayOffset = 0;
          if (index === entries.length - 1) dayOffset = daySpan;
        }

        return {
          date: new Date(
            startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000
          ),
          intensity: entry.intensity,
          painType: entry.painType,
          status: entry.status,
        };
      });

      // Sort by date
      timelineEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        region,
        entries: timelineEntries,
      };
    });
  });

/**
 * Generate timeline data with controlled intensity patterns
 * for testing trend consistency
 */
const worseningTimelineArb: fc.Arbitrary<TimelineData> = fc
  .tuple(
    regionArb,
    fc.integer({ min: 6, max: 20 }), // Number of entries
    fc.integer({ min: 8, max: 30 }), // Day span (> 7 days)
    fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2028-01-01").getTime() }) // Start date timestamp
  )
  .chain(([region, numEntries, daySpan, startTimestamp]) => {
    const startDate = new Date(startTimestamp);
    const entriesArb = fc.array(
      fc.record({
        dayOffset: fc.integer({ min: 0, max: daySpan }),
        earlyIntensity: fc.integer({ min: 0, max: 4 }), // Early entries: 0-4
        lateIntensity: fc.integer({ min: 6, max: 10 }), // Late entries: 6-10
        painType: painTypeArb,
        status: fc.constantFrom("appeared", "active", "resolved") as fc.Arbitrary<
          "appeared" | "active" | "resolved"
        >,
      }),
      { minLength: numEntries, maxLength: numEntries }
    );

    return entriesArb.map((entries) => {
      const timelineEntries: TimelineEntry[] = entries.map((entry, index) => {
        // Force first entry to be at day 0 and last entry to be at the end
        let dayOffset = entry.dayOffset;
        if (index === 0) dayOffset = 0;
        if (index === entries.length - 1) dayOffset = daySpan;

        // Create worsening pattern: intensity increases over time
        // Early entries: 0-4, Late entries: 6-10
        const isEarlyHalf = index < numEntries / 2;
        const intensity = isEarlyHalf ? entry.earlyIntensity : entry.lateIntensity;

        return {
          date: new Date(
            startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000
          ),
          intensity,
          painType: entry.painType,
          status: entry.status,
        };
      });

      // Sort by date
      timelineEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        region,
        entries: timelineEntries,
      };
    });
  });

const improvingTimelineArb: fc.Arbitrary<TimelineData> = fc
  .tuple(
    regionArb,
    fc.integer({ min: 6, max: 20 }), // Number of entries
    fc.integer({ min: 8, max: 30 }), // Day span (> 7 days)
    fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2028-01-01").getTime() }) // Start date timestamp
  )
  .chain(([region, numEntries, daySpan, startTimestamp]) => {
    const startDate = new Date(startTimestamp);
    const entriesArb = fc.array(
      fc.record({
        dayOffset: fc.integer({ min: 0, max: daySpan }),
        earlyIntensity: fc.integer({ min: 6, max: 10 }), // Early entries: 6-10
        lateIntensity: fc.integer({ min: 0, max: 4 }), // Late entries: 0-4
        painType: painTypeArb,
        status: fc.constantFrom("appeared", "active", "resolved") as fc.Arbitrary<
          "appeared" | "active" | "resolved"
        >,
      }),
      { minLength: numEntries, maxLength: numEntries }
    );

    return entriesArb.map((entries) => {
      const timelineEntries: TimelineEntry[] = entries.map((entry, index) => {
        // Force first entry to be at day 0 and last entry to be at the end
        let dayOffset = entry.dayOffset;
        if (index === 0) dayOffset = 0;
        if (index === entries.length - 1) dayOffset = daySpan;

        // Create improving pattern: intensity decreases over time
        // Early entries: 6-10, Late entries: 0-4
        const isEarlyHalf = index < numEntries / 2;
        const intensity = isEarlyHalf ? entry.earlyIntensity : entry.lateIntensity;

        return {
          date: new Date(
            startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000
          ),
          intensity,
          painType: entry.painType,
          status: entry.status,
        };
      });

      // Sort by date
      timelineEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

      return {
        region,
        entries: timelineEntries,
      };
    });
  });

// --- Mock Pool ---

/**
 * Creates a mock database pool (not used for computeTrend, but required for service instantiation)
 */
function createMockPool() {
  return {
    query: async () => ({ rows: [] }),
  } as any;
}

// --- Helper Functions ---

/**
 * Calculate the time span in days for timeline data
 */
function calculateDaySpan(data: TimelineData): number {
  if (data.entries.length === 0) return 0;

  const sortedEntries = [...data.entries].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const firstDate = sortedEntries[0].date;
  const lastDate = sortedEntries[sortedEntries.length - 1].date;

  return (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Calculate average intensity for early and late periods
 */
function calculatePeriodAverages(data: TimelineData): {
  earlyAvg: number;
  lateAvg: number;
} {
  if (data.entries.length === 0) {
    return { earlyAvg: 0, lateAvg: 0 };
  }

  const sortedEntries = [...data.entries].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const midpoint = Math.floor(sortedEntries.length / 2);
  const earlyPeriod = sortedEntries.slice(0, midpoint);
  const latePeriod = sortedEntries.slice(midpoint);

  const earlyAvg =
    earlyPeriod.reduce((sum, entry) => sum + entry.intensity, 0) /
    earlyPeriod.length;
  const lateAvg =
    latePeriod.reduce((sum, entry) => sum + entry.intensity, 0) /
    latePeriod.length;

  return { earlyAvg, lateAvg };
}

// --- Tests ---

describe("Property 15: Trend computation for extended timelines", () => {
  const mockPool = createMockPool();
  const service = new SymptomTimelineServiceImpl(mockPool);

  it("should return non-null trend for data spanning > 7 days", () => {
    fc.assert(
      fc.property(extendedTimelineDataArb, (data) => {
        const daySpan = calculateDaySpan(data);

        // Verify test data spans > 7 days
        expect(daySpan).toBeGreaterThan(7);

        const trend: Trend = service.computeTrend(data);

        // Property 1: Trend should be non-null
        expect(trend).not.toBeNull();
        expect(trend).toBeDefined();

        // Property 2: Trend should be one of the valid values
        expect(["worsening", "improving", "stable"]).toContain(trend);
      }),
      { numRuns: 20 }
    );
  });

  it("should return stable for data spanning ≤ 7 days", () => {
    fc.assert(
      fc.property(shortTimelineDataArb, (data) => {
        const daySpan = calculateDaySpan(data);

        // Verify test data spans ≤ 7 days
        expect(daySpan).toBeLessThanOrEqual(7);

        const trend: Trend = service.computeTrend(data);

        // Property: Trend should always be "stable" for short timelines
        expect(trend).toBe("stable");
      }),
      { numRuns: 20 }
    );
  });

  it("should return trend consistent with intensity direction for extended timelines", () => {
    fc.assert(
      fc.property(extendedTimelineDataArb, (data) => {
        const daySpan = calculateDaySpan(data);

        // Only test extended timelines
        if (daySpan <= 7) return true;

        const trend: Trend = service.computeTrend(data);
        const { earlyAvg, lateAvg } = calculatePeriodAverages(data);
        const intensityChange = lateAvg - earlyAvg;
        const threshold = 0.5;

        // Property: Trend should be consistent with intensity direction
        if (intensityChange > threshold) {
          expect(trend).toBe("worsening");
        } else if (intensityChange < -threshold) {
          expect(trend).toBe("improving");
        } else {
          expect(trend).toBe("stable");
        }
      }),
      { numRuns: 20 }
    );
  });

  it("should return worsening trend for clearly worsening patterns", () => {
    fc.assert(
      fc.property(worseningTimelineArb, (data) => {
        const daySpan = calculateDaySpan(data);

        // Verify test data spans > 7 days
        expect(daySpan).toBeGreaterThan(7);

        const trend: Trend = service.computeTrend(data);
        const { earlyAvg, lateAvg } = calculatePeriodAverages(data);

        // Property: For worsening patterns, trend should be "worsening"
        // (or "stable" if the difference is below threshold)
        if (lateAvg - earlyAvg > 0.5) {
          expect(trend).toBe("worsening");
        }
      }),
      { numRuns: 20 }
    );
  });

  it("should return improving trend for clearly improving patterns", () => {
    fc.assert(
      fc.property(improvingTimelineArb, (data) => {
        const daySpan = calculateDaySpan(data);

        // Verify test data spans > 7 days
        expect(daySpan).toBeGreaterThan(7);

        const trend: Trend = service.computeTrend(data);
        const { earlyAvg, lateAvg } = calculatePeriodAverages(data);

        // Property: For improving patterns, trend should be "improving"
        // (or "stable" if the difference is below threshold)
        if (earlyAvg - lateAvg > 0.5) {
          expect(trend).toBe("improving");
        }
      }),
      { numRuns: 20 }
    );
  });

  it("should handle empty timeline data", () => {
    const emptyData: TimelineData = {
      region: {
        id: "test-region",
        name: "Test Region",
        bodySystem: "musculoskeletal",
      },
      entries: [],
    };

    const trend: Trend = service.computeTrend(emptyData);

    // Property: Empty data should return "stable"
    expect(trend).toBe("stable");
  });

  it("should handle single entry timeline", () => {
    fc.assert(
      fc.property(
        regionArb,
        intensityArb,
        painTypeArb,
        fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2029-01-01").getTime() }),
        (region, intensity, painType, dateTimestamp) => {
          const date = new Date(dateTimestamp);
          const data: TimelineData = {
            region,
            entries: [
              {
                date,
                intensity,
                painType,
                status: "active",
              },
            ],
          };

          const trend: Trend = service.computeTrend(data);

          // Property: Single entry (0 day span) should return "stable"
          expect(trend).toBe("stable");
        }
      ),
      { numRuns: 20 }
    );
  });
});
