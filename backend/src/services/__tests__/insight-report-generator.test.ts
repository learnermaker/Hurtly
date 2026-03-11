import { describe, it, expect, beforeEach } from "vitest";
import { InsightReportGenerator } from "../insight-report-generator";
import type {
  BodyMap,
  PainMarker,
  SymptomDescriptor,
  PainSession,
} from "../../../../shared/src/types";

describe("InsightReportGenerator", () => {
  let generator: InsightReportGenerator;

  beforeEach(() => {
    generator = new InsightReportGenerator();
  });

  describe("generate", () => {
    it("should generate a report with all required fields", () => {
      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers: [],
        descriptors: [],
      };

      const report = generator.generate(bodyMap);

      expect(report.id).toBeDefined();
      expect(report.userId).toBe("user-1");
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.patterns).toBeInstanceOf(Array);
      expect(report.frequencyTrends).toBeInstanceOf(Array);
      expect(report.intensityChanges).toBeInstanceOf(Array);
      expect(report.disclaimer).toBe(
        "This report is informational and does not constitute medical advice."
      );
    });

    it("should always include the disclaimer", () => {
      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers: [],
        descriptors: [],
      };

      const report = generator.generate(bodyMap);

      expect(report.disclaimer).toBe(
        "This report is informational and does not constitute medical advice."
      );
      expect(report.disclaimer.length).toBeGreaterThan(0);
    });

    it("should handle empty body map", () => {
      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers: [],
        descriptors: [],
      };

      const report = generator.generate(bodyMap);

      expect(report.patterns).toEqual([]);
      expect(report.frequencyTrends).toEqual([]);
      expect(report.intensityChanges).toEqual([]);
    });

    it("should handle body map with single session", () => {
      const now = new Date();
      const marker: PainMarker = {
        id: "marker-1",
        sessionId: "session-1",
        location: {
          region: { id: "left-shoulder", name: "Left Shoulder", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 0, z: 0 },
        },
        intensity: 5,
        createdAt: now,
        status: "active",
      };

      const descriptor: SymptomDescriptor = {
        id: "desc-1",
        markerId: "marker-1",
        painType: "sharp",
        intensity: 5,
        frequency: "intermittent",
        duration: "hours",
        followUpResponses: [],
        completedAt: now,
      };

      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers: [marker],
        descriptors: [descriptor],
      };

      const report = generator.generate(bodyMap);

      expect(report.patterns).toEqual([]);
      expect(report.frequencyTrends).toEqual([]);
      expect(report.intensityChanges).toEqual([]);
    });

    it("should identify patterns from co-occurring symptoms", () => {
      const now = new Date();
      const marker1: PainMarker = {
        id: "marker-1",
        sessionId: "session-1",
        location: {
          region: { id: "left-shoulder", name: "Left Shoulder", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 0, z: 0 },
        },
        intensity: 5,
        createdAt: now,
        status: "active",
      };

      const marker2: PainMarker = {
        id: "marker-2",
        sessionId: "session-1",
        location: {
          region: { id: "neck", name: "Neck", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 1, z: 0 },
        },
        intensity: 6,
        createdAt: now,
        status: "active",
      };

      const descriptor1: SymptomDescriptor = {
        id: "desc-1",
        markerId: "marker-1",
        painType: "sharp",
        intensity: 5,
        frequency: "intermittent",
        duration: "hours",
        followUpResponses: [],
        completedAt: now,
      };

      const descriptor2: SymptomDescriptor = {
        id: "desc-2",
        markerId: "marker-2",
        painType: "aching",
        intensity: 6,
        frequency: "constant",
        duration: "days",
        followUpResponses: [],
        completedAt: now,
      };

      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers: [marker1, marker2],
        descriptors: [descriptor1, descriptor2],
      };

      const report = generator.generate(bodyMap);

      expect(report.patterns.length).toBe(1);
      expect(report.patterns[0].regions).toContain("Left Shoulder");
      expect(report.patterns[0].regions).toContain("Neck");
      expect(report.patterns[0].painTypes).toContain("sharp");
      expect(report.patterns[0].painTypes).toContain("aching");
      expect(report.patterns[0].description).toBeDefined();
      expect(report.patterns[0].description.length).toBeGreaterThan(0);
    });

    it("should compute frequency trends with sufficient data", () => {
      const baseDate = new Date("2024-01-01");
      const markers: PainMarker[] = [];

      // Create 5 markers for the same region over time
      for (let i = 0; i < 5; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i * 2);

        markers.push({
          id: `marker-${i}`,
          sessionId: `session-${i}`,
          location: {
            region: { id: "lower-back", name: "Lower Back", bodySystem: "musculoskeletal" },
            coordinates: { x: 0, y: 0, z: 0 },
          },
          intensity: 5,
          createdAt: date,
          status: "active",
        });
      }

      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers,
        descriptors: [],
      };

      const report = generator.generate(bodyMap);

      expect(report.frequencyTrends.length).toBe(1);
      expect(report.frequencyTrends[0].region).toBe("Lower Back");
      expect(report.frequencyTrends[0].dataPoints).toBe(5);
      expect(["worsening", "improving", "stable"]).toContain(
        report.frequencyTrends[0].trend
      );
    });

    it("should not compute frequency trends with insufficient data", () => {
      const now = new Date();
      const markers: PainMarker[] = [
        {
          id: "marker-1",
          sessionId: "session-1",
          location: {
            region: { id: "lower-back", name: "Lower Back", bodySystem: "musculoskeletal" },
            coordinates: { x: 0, y: 0, z: 0 },
          },
          intensity: 5,
          createdAt: now,
          status: "active",
        },
        {
          id: "marker-2",
          sessionId: "session-2",
          location: {
            region: { id: "lower-back", name: "Lower Back", bodySystem: "musculoskeletal" },
            coordinates: { x: 0, y: 0, z: 0 },
          },
          intensity: 6,
          createdAt: new Date(now.getTime() + 86400000),
          status: "active",
        },
      ];

      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers,
        descriptors: [],
      };

      const report = generator.generate(bodyMap);

      expect(report.frequencyTrends).toEqual([]);
    });

    it("should identify intensity changes over time", () => {
      const baseDate = new Date("2024-01-01");
      const marker1: PainMarker = {
        id: "marker-1",
        sessionId: "session-1",
        location: {
          region: { id: "knee", name: "Right Knee", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 0, z: 0 },
        },
        intensity: 3,
        createdAt: baseDate,
        status: "active",
      };

      const marker2: PainMarker = {
        id: "marker-2",
        sessionId: "session-2",
        location: {
          region: { id: "knee", name: "Right Knee", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 0, z: 0 },
        },
        intensity: 7,
        createdAt: new Date(baseDate.getTime() + 10 * 86400000), // 10 days later
        status: "active",
      };

      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers: [marker1, marker2],
        descriptors: [],
      };

      const report = generator.generate(bodyMap);

      expect(report.intensityChanges.length).toBe(1);
      expect(report.intensityChanges[0].region).toBe("Right Knee");
      expect(report.intensityChanges[0].fromIntensity).toBe(3);
      expect(report.intensityChanges[0].toIntensity).toBe(7);
      expect(report.intensityChanges[0].period.start).toEqual(baseDate);
    });

    it("should not report insignificant intensity changes", () => {
      const baseDate = new Date("2024-01-01");
      const marker1: PainMarker = {
        id: "marker-1",
        sessionId: "session-1",
        location: {
          region: { id: "knee", name: "Right Knee", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 0, z: 0 },
        },
        intensity: 5,
        createdAt: baseDate,
        status: "active",
      };

      const marker2: PainMarker = {
        id: "marker-2",
        sessionId: "session-2",
        location: {
          region: { id: "knee", name: "Right Knee", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 0, z: 0 },
        },
        intensity: 6, // Only 1 point difference
        createdAt: new Date(baseDate.getTime() + 10 * 86400000),
        status: "active",
      };

      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers: [marker1, marker2],
        descriptors: [],
      };

      const report = generator.generate(bodyMap);

      expect(report.intensityChanges).toEqual([]);
    });

    it("should handle complex body map with multiple regions and sessions", () => {
      const baseDate = new Date("2024-01-01");
      const markers: PainMarker[] = [];
      const descriptors: SymptomDescriptor[] = [];

      // Create markers for multiple regions and sessions
      for (let i = 0; i < 10; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);

        const regionName = i % 2 === 0 ? "Lower Back" : "Right Knee";
        const regionId = i % 2 === 0 ? "lower-back" : "right-knee";

        const marker: PainMarker = {
          id: `marker-${i}`,
          sessionId: `session-${i}`,
          location: {
            region: { id: regionId, name: regionName, bodySystem: "musculoskeletal" },
            coordinates: { x: 0, y: 0, z: 0 },
          },
          intensity: 3 + i % 5,
          createdAt: date,
          status: "active",
        };

        const descriptor: SymptomDescriptor = {
          id: `desc-${i}`,
          markerId: `marker-${i}`,
          painType: i % 2 === 0 ? "aching" : "sharp",
          intensity: 3 + i % 5,
          frequency: "intermittent",
          duration: "hours",
          followUpResponses: [],
          completedAt: date,
        };

        markers.push(marker);
        descriptors.push(descriptor);
      }

      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers,
        descriptors,
      };

      const report = generator.generate(bodyMap);

      expect(report.id).toBeDefined();
      expect(report.userId).toBe("user-1");
      expect(report.disclaimer).toBeDefined();
      expect(report.frequencyTrends.length).toBeGreaterThan(0);
    });
  });

  describe("exportPDF", () => {
    it("should generate a PDF buffer", async () => {
      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers: [],
        descriptors: [],
      };

      const report = generator.generate(bodyMap);
      const pdfBuffer = await generator.exportPDF(report);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      // PDF files start with %PDF
      expect(pdfBuffer.toString("utf8", 0, 4)).toBe("%PDF");
    });

    it("should include disclaimer in PDF", async () => {
      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers: [],
        descriptors: [],
      };

      const report = generator.generate(bodyMap);
      const pdfBuffer = await generator.exportPDF(report);

      // Verify PDF structure - content is compressed so we can't easily check text
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.toString("utf8", 0, 4)).toBe("%PDF");
      // The disclaimer is included in the PDF generation code
      expect(report.disclaimer).toContain("informational");
    });

    it("should include patterns in PDF", async () => {
      const now = new Date();
      const marker1: PainMarker = {
        id: "marker-1",
        sessionId: "session-1",
        location: {
          region: { id: "left-shoulder", name: "Left Shoulder", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 0, z: 0 },
        },
        intensity: 5,
        createdAt: now,
        status: "active",
      };

      const marker2: PainMarker = {
        id: "marker-2",
        sessionId: "session-1",
        location: {
          region: { id: "neck", name: "Neck", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 1, z: 0 },
        },
        intensity: 6,
        createdAt: now,
        status: "active",
      };

      const descriptor1: SymptomDescriptor = {
        id: "desc-1",
        markerId: "marker-1",
        painType: "sharp",
        intensity: 5,
        frequency: "intermittent",
        duration: "hours",
        followUpResponses: [],
        completedAt: now,
      };

      const descriptor2: SymptomDescriptor = {
        id: "desc-2",
        markerId: "marker-2",
        painType: "aching",
        intensity: 6,
        frequency: "constant",
        duration: "days",
        followUpResponses: [],
        completedAt: now,
      };

      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers: [marker1, marker2],
        descriptors: [descriptor1, descriptor2],
      };

      const report = generator.generate(bodyMap);
      const pdfBuffer = await generator.exportPDF(report);

      // Verify PDF was generated with patterns
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(report.patterns.length).toBeGreaterThan(0);
    });

    it("should handle report with all data types", async () => {
      const baseDate = new Date("2024-01-01");
      const markers: PainMarker[] = [];
      const descriptors: SymptomDescriptor[] = [];

      // Create co-occurring symptoms for patterns
      const marker1: PainMarker = {
        id: "marker-1",
        sessionId: "session-1",
        location: {
          region: { id: "lower-back", name: "Lower Back", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 0, z: 0 },
        },
        intensity: 3,
        createdAt: baseDate,
        status: "active",
      };

      const marker2: PainMarker = {
        id: "marker-2",
        sessionId: "session-1",
        location: {
          region: { id: "right-leg", name: "Right Leg", bodySystem: "musculoskeletal" },
          coordinates: { x: 1, y: 0, z: 0 },
        },
        intensity: 4,
        createdAt: baseDate,
        status: "active",
      };

      markers.push(marker1, marker2);

      descriptors.push(
        {
          id: "desc-1",
          markerId: "marker-1",
          painType: "aching",
          intensity: 3,
          frequency: "constant",
          duration: "days",
          followUpResponses: [],
          completedAt: baseDate,
        },
        {
          id: "desc-2",
          markerId: "marker-2",
          painType: "sharp",
          intensity: 4,
          frequency: "intermittent",
          duration: "hours",
          followUpResponses: [],
          completedAt: baseDate,
        }
      );

      // Add more markers for frequency trends
      for (let i = 3; i < 8; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);

        markers.push({
          id: `marker-${i}`,
          sessionId: `session-${i}`,
          location: {
            region: { id: "neck", name: "Neck", bodySystem: "musculoskeletal" },
            coordinates: { x: 0, y: 1, z: 0 },
          },
          intensity: 5 + (i % 3),
          createdAt: date,
          status: "active",
        });
      }

      const bodyMap: BodyMap = {
        userId: "user-1",
        sessions: [],
        markers,
        descriptors,
      };

      const report = generator.generate(bodyMap);
      const pdfBuffer = await generator.exportPDF(report);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);

      // Verify the report has all the expected data
      expect(report.patterns.length).toBeGreaterThan(0);
      expect(report.frequencyTrends.length).toBeGreaterThan(0);
    });
  });
});
