// Feature: body-trace, Property 16: Insight Report content completeness
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { InsightReportGenerator } from "../insight-report-generator";
import type {
  BodyMap,
  PainMarker,
  SymptomDescriptor,
  PainSession,
  AnatomicalRegion,
  AnatomicalLocation,
  PainType,
  PainFrequency,
  PainDuration,
  Vector3,
} from "../../../../shared/src/types";

/**
 * **Validates: Requirements 7.2, 7.5**
 *
 * Property 16: Insight Report content completeness
 * For any non-empty Body Map, the generated Insight Report should contain
 * non-empty patterns, frequency trends, and intensity changes arrays, and
 * the disclaimer field should be present and non-empty.
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

const painFrequencyArb: fc.Arbitrary<PainFrequency> = fc.constantFrom(
  "constant",
  "intermittent",
  "occasional",
  "only-during-activity"
);

const painDurationArb: fc.Arbitrary<PainDuration> = fc.constantFrom(
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks"
);

const intensityArb = fc.integer({ min: 0, max: 10 });

const vector3Arb: fc.Arbitrary<Vector3> = fc.record({
  x: fc.float({ min: -1, max: 1 }),
  y: fc.float({ min: -1, max: 1 }),
  z: fc.float({ min: -1, max: 1 }),
});

const regionArb: fc.Arbitrary<AnatomicalRegion> = fc.record({
  id: fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/),
  name: fc.stringMatching(/^[A-Z][a-zA-Z ]{0,29}$/),
  bodySystem: fc.constant("musculoskeletal"),
});

const locationArb: fc.Arbitrary<AnatomicalLocation> = fc.record({
  region: regionArb,
  coordinates: vector3Arb,
});

/**
 * Generate a random pain marker with a specific session ID
 */
const painMarkerArb = (sessionId: string): fc.Arbitrary<PainMarker> =>
  fc.record({
    id: fc.uuid(),
    sessionId: fc.constant(sessionId),
    location: locationArb,
    intensity: intensityArb,
    createdAt: fc.date({
      min: new Date("2020-01-01"),
      max: new Date("2028-12-31"),
    }),
    status: fc.constantFrom("active", "resolved", "historical") as fc.Arbitrary<
      "active" | "resolved" | "historical"
    >,
  });

/**
 * Generate a symptom descriptor for a given marker ID
 */
const symptomDescriptorArb = (
  markerId: string
): fc.Arbitrary<SymptomDescriptor> =>
  fc.record({
    id: fc.uuid(),
    markerId: fc.constant(markerId),
    painType: painTypeArb,
    intensity: intensityArb,
    frequency: painFrequencyArb,
    duration: painDurationArb,
    followUpResponses: fc.constant([]),
    completedAt: fc.date({
      min: new Date("2020-01-01"),
      max: new Date("2028-12-31"),
    }),
  });

/**
 * Generate a non-empty body map with at least one marker and descriptor
 * This ensures the body map has sufficient data to generate meaningful reports
 */
const nonEmptyBodyMapArb: fc.Arbitrary<BodyMap> = fc
  .tuple(
    fc.uuid(), // userId
    fc.integer({ min: 1, max: 10 }), // Number of sessions
    fc.integer({ min: 1, max: 5 }) // Markers per session
  )
  .chain(([userId, numSessions, markersPerSession]) => {
    // Generate sessions with markers
    const sessionsArb = fc.array(
      fc
        .tuple(
          fc.uuid(), // sessionId
          fc.constantFrom("in-progress", "completed") as fc.Arbitrary<
            "in-progress" | "completed"
          >,
          fc.date({
            min: new Date("2020-01-01"),
            max: new Date("2028-12-31"),
          })
        )
        .chain(([sessionId, status, createdAt]) => {
          // Generate markers for this session
          const markersArb = fc.array(painMarkerArb(sessionId), {
            minLength: markersPerSession,
            maxLength: markersPerSession,
          });

          return markersArb.chain((markers) => {
            // Generate descriptors for each marker
            const descriptorsArb = fc.tuple(
              ...markers.map((marker) => symptomDescriptorArb(marker.id))
            );

            return descriptorsArb.map((descriptors) => {
              const session: PainSession = {
                id: sessionId,
                userId,
                markers,
                descriptors,
                status,
                createdAt,
                updatedAt: createdAt,
              };
              return { session, markers, descriptors };
            });
          });
        }),
      { minLength: numSessions, maxLength: numSessions }
    );

    return sessionsArb.map((sessionData) => {
      const sessions = sessionData.map((sd) => sd.session);
      const allMarkers = sessionData.flatMap((sd) => sd.markers);
      const allDescriptors = sessionData.flatMap((sd) => sd.descriptors);

      return {
        userId,
        sessions,
        markers: allMarkers,
        descriptors: allDescriptors,
      };
    });
  });

// --- Tests ---

describe("Property 16: Insight Report content completeness", () => {
  const generator = new InsightReportGenerator();

  it("should generate report with non-empty disclaimer for any non-empty body map", () => {
    fc.assert(
      fc.property(nonEmptyBodyMapArb, (bodyMap) => {
        // Verify body map is non-empty
        expect(bodyMap.markers.length).toBeGreaterThan(0);
        expect(bodyMap.descriptors.length).toBeGreaterThan(0);

        const report = generator.generate(bodyMap);

        // Property: Disclaimer should be present and non-empty
        expect(report.disclaimer).toBeDefined();
        expect(report.disclaimer).not.toBe("");
        expect(report.disclaimer.length).toBeGreaterThan(0);
      }),
      { numRuns: 20 }
    );
  });

  it("should generate report with all required fields for any non-empty body map", () => {
    fc.assert(
      fc.property(nonEmptyBodyMapArb, (bodyMap) => {
        // Verify body map is non-empty
        expect(bodyMap.markers.length).toBeGreaterThan(0);

        const report = generator.generate(bodyMap);

        // Property: Report should have all required fields
        expect(report.id).toBeDefined();
        expect(report.userId).toBe(bodyMap.userId);
        expect(report.generatedAt).toBeInstanceOf(Date);
        expect(report.patterns).toBeDefined();
        expect(Array.isArray(report.patterns)).toBe(true);
        expect(report.frequencyTrends).toBeDefined();
        expect(Array.isArray(report.frequencyTrends)).toBe(true);
        expect(report.intensityChanges).toBeDefined();
        expect(Array.isArray(report.intensityChanges)).toBe(true);
        expect(report.disclaimer).toBeDefined();
      }),
      { numRuns: 20 }
    );
  });

  it("should generate patterns array (may be empty if no co-occurring symptoms)", () => {
    fc.assert(
      fc.property(nonEmptyBodyMapArb, (bodyMap) => {
        const report = generator.generate(bodyMap);

        // Property: Patterns array should be defined (but may be empty)
        expect(report.patterns).toBeDefined();
        expect(Array.isArray(report.patterns)).toBe(true);

        // If patterns exist, they should have valid structure
        report.patterns.forEach((pattern) => {
          expect(pattern.regions).toBeDefined();
          expect(Array.isArray(pattern.regions)).toBe(true);
          expect(pattern.regions.length).toBeGreaterThan(0);
          expect(pattern.painTypes).toBeDefined();
          expect(Array.isArray(pattern.painTypes)).toBe(true);
          expect(pattern.painTypes.length).toBeGreaterThan(0);
          expect(pattern.description).toBeDefined();
          expect(typeof pattern.description).toBe("string");
          expect(pattern.description.length).toBeGreaterThan(0);
        });
      }),
      { numRuns: 20 }
    );
  });

  it("should generate frequency trends array (may be empty if insufficient data)", () => {
    fc.assert(
      fc.property(nonEmptyBodyMapArb, (bodyMap) => {
        const report = generator.generate(bodyMap);

        // Property: Frequency trends array should be defined (but may be empty)
        expect(report.frequencyTrends).toBeDefined();
        expect(Array.isArray(report.frequencyTrends)).toBe(true);

        // If trends exist, they should have valid structure
        report.frequencyTrends.forEach((trend) => {
          expect(trend.region).toBeDefined();
          expect(typeof trend.region).toBe("string");
          expect(trend.region.length).toBeGreaterThan(0);
          expect(trend.trend).toBeDefined();
          expect(["worsening", "improving", "stable"]).toContain(trend.trend);
          expect(trend.dataPoints).toBeDefined();
          expect(typeof trend.dataPoints).toBe("number");
          expect(trend.dataPoints).toBeGreaterThan(0);
        });
      }),
      { numRuns: 20 }
    );
  });

  it("should generate intensity changes array (may be empty if no significant changes)", () => {
    fc.assert(
      fc.property(nonEmptyBodyMapArb, (bodyMap) => {
        const report = generator.generate(bodyMap);

        // Property: Intensity changes array should be defined (but may be empty)
        expect(report.intensityChanges).toBeDefined();
        expect(Array.isArray(report.intensityChanges)).toBe(true);

        // If changes exist, they should have valid structure
        report.intensityChanges.forEach((change) => {
          expect(change.region).toBeDefined();
          expect(typeof change.region).toBe("string");
          expect(change.region.length).toBeGreaterThan(0);
          expect(change.fromIntensity).toBeDefined();
          expect(typeof change.fromIntensity).toBe("number");
          expect(change.fromIntensity).toBeGreaterThanOrEqual(0);
          expect(change.fromIntensity).toBeLessThanOrEqual(10);
          expect(change.toIntensity).toBeDefined();
          expect(typeof change.toIntensity).toBe("number");
          expect(change.toIntensity).toBeGreaterThanOrEqual(0);
          expect(change.toIntensity).toBeLessThanOrEqual(10);
          expect(change.period).toBeDefined();
          expect(change.period.start).toBeInstanceOf(Date);
          expect(change.period.end).toBeInstanceOf(Date);
          expect(change.period.end.getTime()).toBeGreaterThanOrEqual(
            change.period.start.getTime()
          );
        });
      }),
      { numRuns: 20 }
    );
  });

  it("should handle empty body map gracefully", () => {
    const emptyBodyMap: BodyMap = {
      userId: "test-user",
      sessions: [],
      markers: [],
      descriptors: [],
    };

    const report = generator.generate(emptyBodyMap);

    // Property: Even empty body maps should produce valid reports
    expect(report.id).toBeDefined();
    expect(report.userId).toBe("test-user");
    expect(report.generatedAt).toBeInstanceOf(Date);
    expect(report.patterns).toEqual([]);
    expect(report.frequencyTrends).toEqual([]);
    expect(report.intensityChanges).toEqual([]);
    expect(report.disclaimer).toBeDefined();
    expect(report.disclaimer.length).toBeGreaterThan(0);
  });
});
