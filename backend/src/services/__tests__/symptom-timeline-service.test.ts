import { describe, it, expect, vi } from "vitest";
import { Pool } from "pg";
import {
  SymptomTimelineServiceImpl,
  SymptomTimelineService,
} from "../symptom-timeline-service";
import {
  AnatomicalRegion,
  TimelineData,
  TimelineEntry,
} from "../../../../shared/src/types";

describe("SymptomTimelineService", () => {
  const testUserId = "test-user-id";

  describe("getTimeline", () => {
    it("should return chronologically ordered timeline entries", async () => {
      const region: AnatomicalRegion = {
        id: "left-shoulder",
        name: "Left Shoulder",
        bodySystem: "musculoskeletal",
      };

      const date1 = new Date("2024-01-01");
      const date2 = new Date("2024-01-05");
      const date3 = new Date("2024-01-10");

      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              date: date1,
              intensity: 5,
              pain_type: "sharp",
              marker_id: "m1",
            },
            {
              date: date2,
              intensity: 7,
              pain_type: "sharp",
              marker_id: "m2",
            },
            {
              date: date3,
              intensity: 3,
              pain_type: "sharp",
              marker_id: "m3",
            },
          ],
        }),
      } as any;

      const service = new SymptomTimelineServiceImpl(mockPool);
      const timeline = await service.getTimeline(testUserId, region);

      // Verify chronological ordering
      expect(timeline.entries).toHaveLength(3);
      expect(timeline.entries[0].date.getTime()).toBe(date1.getTime());
      expect(timeline.entries[1].date.getTime()).toBe(date2.getTime());
      expect(timeline.entries[2].date.getTime()).toBe(date3.getTime());

      // Verify intensities
      expect(timeline.entries[0].intensity).toBe(5);
      expect(timeline.entries[1].intensity).toBe(7);
      expect(timeline.entries[2].intensity).toBe(3);
    });

    it("should mark first occurrence as 'appeared'", async () => {
      const region: AnatomicalRegion = {
        id: "lower-back",
        name: "Lower Back",
        bodySystem: "musculoskeletal",
      };

      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              date: new Date("2024-01-01"),
              intensity: 6,
              pain_type: "dull",
              marker_id: "m1",
            },
          ],
        }),
      } as any;

      const service = new SymptomTimelineServiceImpl(mockPool);
      const timeline = await service.getTimeline(testUserId, region);

      // Verify first occurrence is marked as "appeared"
      expect(timeline.entries).toHaveLength(1);
      expect(timeline.entries[0].status).toBe("appeared");
      expect(timeline.entries[0].painType).toBe("dull");
    });

    it("should mark subsequent occurrences as 'active'", async () => {
      const region: AnatomicalRegion = {
        id: "right-knee",
        name: "Right Knee",
        bodySystem: "musculoskeletal",
      };

      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              date: new Date("2024-01-01"),
              intensity: 4,
              pain_type: "throbbing",
              marker_id: "m1",
            },
            {
              date: new Date("2024-01-03"),
              intensity: 5,
              pain_type: "throbbing",
              marker_id: "m2",
            },
            {
              date: new Date("2024-01-05"),
              intensity: 6,
              pain_type: "throbbing",
              marker_id: "m3",
            },
          ],
        }),
      } as any;

      const service = new SymptomTimelineServiceImpl(mockPool);
      const timeline = await service.getTimeline(testUserId, region);

      // Verify status progression
      expect(timeline.entries).toHaveLength(3);
      expect(timeline.entries[0].status).toBe("appeared");
      expect(timeline.entries[1].status).toBe("active");
      expect(timeline.entries[2].status).toBe("active");
    });

    it("should mark cessation as 'resolved'", async () => {
      const region: AnatomicalRegion = {
        id: "chest",
        name: "Chest",
        bodySystem: "musculoskeletal",
      };

      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [
            {
              date: new Date("2024-01-01"),
              intensity: 5,
              pain_type: "burning",
              marker_id: "m1",
            },
            {
              date: new Date("2024-01-05"),
              intensity: 6,
              pain_type: "aching",
              marker_id: "m2",
            },
          ],
        }),
      } as any;

      const service = new SymptomTimelineServiceImpl(mockPool);
      const timeline = await service.getTimeline(testUserId, region);

      // Verify the first pain type is marked as resolved
      expect(timeline.entries).toHaveLength(2);
      expect(timeline.entries[0].painType).toBe("burning");
      expect(timeline.entries[0].status).toBe("resolved");
      expect(timeline.entries[1].painType).toBe("aching");
      expect(timeline.entries[1].status).toBe("appeared");
    });

    it("should return empty timeline for region with no data", async () => {
      const region: AnatomicalRegion = {
        id: "left-ankle",
        name: "Left Ankle",
        bodySystem: "musculoskeletal",
      };

      const mockPool = {
        query: vi.fn().mockResolvedValue({
          rows: [],
        }),
      } as any;

      const service = new SymptomTimelineServiceImpl(mockPool);
      const timeline = await service.getTimeline(testUserId, region);

      expect(timeline.region).toEqual(region);
      expect(timeline.entries).toHaveLength(0);
    });
  });

  describe("computeTrend", () => {
    it("should return 'stable' for data spanning ≤ 7 days", () => {
      const mockPool = {} as any;
      const service = new SymptomTimelineServiceImpl(mockPool);

      const region: AnatomicalRegion = {
        id: "test-region",
        name: "Test Region",
        bodySystem: "musculoskeletal",
      };

      const entries: TimelineEntry[] = [
        {
          date: new Date("2024-01-01"),
          intensity: 5,
          painType: "sharp",
          status: "appeared",
        },
        {
          date: new Date("2024-01-05"),
          intensity: 7,
          painType: "sharp",
          status: "active",
        },
      ];

      const data: TimelineData = { region, entries };
      const trend = service.computeTrend(data);

      expect(trend).toBe("stable");
    });

    it("should return 'worsening' for increasing intensity over > 7 days", () => {
      const mockPool = {} as any;
      const service = new SymptomTimelineServiceImpl(mockPool);

      const region: AnatomicalRegion = {
        id: "test-region",
        name: "Test Region",
        bodySystem: "musculoskeletal",
      };

      const entries: TimelineEntry[] = [
        {
          date: new Date("2024-01-01"),
          intensity: 3,
          painType: "dull",
          status: "appeared",
        },
        {
          date: new Date("2024-01-05"),
          intensity: 4,
          painType: "dull",
          status: "active",
        },
        {
          date: new Date("2024-01-10"),
          intensity: 7,
          painType: "dull",
          status: "active",
        },
        {
          date: new Date("2024-01-15"),
          intensity: 8,
          painType: "dull",
          status: "active",
        },
      ];

      const data: TimelineData = { region, entries };
      const trend = service.computeTrend(data);

      expect(trend).toBe("worsening");
    });

    it("should return 'improving' for decreasing intensity over > 7 days", () => {
      const mockPool = {} as any;
      const service = new SymptomTimelineServiceImpl(mockPool);

      const region: AnatomicalRegion = {
        id: "test-region",
        name: "Test Region",
        bodySystem: "musculoskeletal",
      };

      const entries: TimelineEntry[] = [
        {
          date: new Date("2024-01-01"),
          intensity: 8,
          painType: "throbbing",
          status: "appeared",
        },
        {
          date: new Date("2024-01-05"),
          intensity: 7,
          painType: "throbbing",
          status: "active",
        },
        {
          date: new Date("2024-01-10"),
          intensity: 4,
          painType: "throbbing",
          status: "active",
        },
        {
          date: new Date("2024-01-15"),
          intensity: 3,
          painType: "throbbing",
          status: "active",
        },
      ];

      const data: TimelineData = { region, entries };
      const trend = service.computeTrend(data);

      expect(trend).toBe("improving");
    });

    it("should return 'stable' for minimal intensity change over > 7 days", () => {
      const mockPool = {} as any;
      const service = new SymptomTimelineServiceImpl(mockPool);

      const region: AnatomicalRegion = {
        id: "test-region",
        name: "Test Region",
        bodySystem: "musculoskeletal",
      };

      const entries: TimelineEntry[] = [
        {
          date: new Date("2024-01-01"),
          intensity: 5,
          painType: "aching",
          status: "appeared",
        },
        {
          date: new Date("2024-01-05"),
          intensity: 5,
          painType: "aching",
          status: "active",
        },
        {
          date: new Date("2024-01-10"),
          intensity: 5,
          painType: "aching",
          status: "active",
        },
        {
          date: new Date("2024-01-15"),
          intensity: 5,
          painType: "aching",
          status: "active",
        },
      ];

      const data: TimelineData = { region, entries };
      const trend = service.computeTrend(data);

      expect(trend).toBe("stable");
    });

    it("should return 'stable' for empty timeline", () => {
      const mockPool = {} as any;
      const service = new SymptomTimelineServiceImpl(mockPool);

      const region: AnatomicalRegion = {
        id: "test-region",
        name: "Test Region",
        bodySystem: "musculoskeletal",
      };

      const data: TimelineData = { region, entries: [] };
      const trend = service.computeTrend(data);

      expect(trend).toBe("stable");
    });

    it("should return 'stable' for single entry", () => {
      const mockPool = {} as any;
      const service = new SymptomTimelineServiceImpl(mockPool);

      const region: AnatomicalRegion = {
        id: "test-region",
        name: "Test Region",
        bodySystem: "musculoskeletal",
      };

      const entries: TimelineEntry[] = [
        {
          date: new Date("2024-01-01"),
          intensity: 5,
          painType: "sharp",
          status: "appeared",
        },
      ];

      const data: TimelineData = { region, entries };
      const trend = service.computeTrend(data);

      expect(trend).toBe("stable");
    });

    it("should return 'stable' for exactly 7 days span", () => {
      const mockPool = {} as any;
      const service = new SymptomTimelineServiceImpl(mockPool);

      const region: AnatomicalRegion = {
        id: "test-region",
        name: "Test Region",
        bodySystem: "musculoskeletal",
      };

      const entries: TimelineEntry[] = [
        {
          date: new Date("2024-01-01"),
          intensity: 3,
          painType: "sharp",
          status: "appeared",
        },
        {
          date: new Date("2024-01-08"),
          intensity: 8,
          painType: "sharp",
          status: "active",
        },
      ];

      const data: TimelineData = { region, entries };
      const trend = service.computeTrend(data);

      expect(trend).toBe("stable");
    });
  });
});
