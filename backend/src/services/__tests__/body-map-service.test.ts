import { describe, it, expect, vi } from "vitest";
import {
  getBodyMap,
  filterMarkers,
  getMarkersByRegion,
  filterMarkersInMemory,
} from "../body-map-service";
import type {
  PainMarker,
  SymptomDescriptor,
  MarkerFilter,
} from "@bodytrace/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMarker(overrides?: Partial<PainMarker>): PainMarker {
  return {
    id: "marker-1",
    sessionId: "session-1",
    location: {
      region: {
        id: "left-shoulder",
        name: "Left Shoulder",
        bodySystem: "musculoskeletal",
      },
      coordinates: { x: 1, y: 2, z: 3 },
    },
    intensity: 5,
    createdAt: new Date("2024-06-15"),
    status: "active",
    ...overrides,
  };
}

function makeDescriptor(
  overrides?: Partial<SymptomDescriptor>
): SymptomDescriptor {
  return {
    id: "desc-1",
    markerId: "marker-1",
    painType: "sharp",
    intensity: 5,
    frequency: "intermittent",
    duration: "hours",
    followUpResponses: [],
    completedAt: new Date("2024-06-15"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// filterMarkersInMemory (pure logic – no DB)
// ---------------------------------------------------------------------------

describe("filterMarkersInMemory", () => {
  const markers: PainMarker[] = [
    makeMarker({
      id: "m1",
      intensity: 3,
      createdAt: new Date("2024-06-01"),
      location: {
        region: { id: "left-shoulder", name: "Left Shoulder", bodySystem: "musculoskeletal" },
        coordinates: { x: 1, y: 2, z: 3 },
      },
    }),
    makeMarker({
      id: "m2",
      intensity: 7,
      createdAt: new Date("2024-06-10"),
      location: {
        region: { id: "lower-back", name: "Lower Back", bodySystem: "musculoskeletal" },
        coordinates: { x: 0, y: 1, z: 0 },
      },
    }),
    makeMarker({
      id: "m3",
      intensity: 9,
      createdAt: new Date("2024-06-20"),
      location: {
        region: { id: "right-knee", name: "Right Knee", bodySystem: "musculoskeletal" },
        coordinates: { x: 2, y: 0, z: 1 },
      },
    }),
  ];

  const descriptors: SymptomDescriptor[] = [
    makeDescriptor({ id: "d1", markerId: "m1", painType: "sharp" }),
    makeDescriptor({ id: "d2", markerId: "m2", painType: "burning" }),
    makeDescriptor({ id: "d3", markerId: "m3", painType: "dull" }),
  ];

  it("should return all markers when no filters are specified", () => {
    const result = filterMarkersInMemory(markers, descriptors, {});
    expect(result).toHaveLength(3);
  });

  it("should filter by date range", () => {
    const filters: MarkerFilter = {
      dateRange: { start: new Date("2024-06-05"), end: new Date("2024-06-15") },
    };
    const result = filterMarkersInMemory(markers, descriptors, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m2");
  });

  it("should filter by pain type", () => {
    const filters: MarkerFilter = { painTypes: ["sharp", "dull"] };
    const result = filterMarkersInMemory(markers, descriptors, filters);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id).sort()).toEqual(["m1", "m3"]);
  });

  it("should filter by intensity range", () => {
    const filters: MarkerFilter = { intensityRange: { min: 5, max: 8 } };
    const result = filterMarkersInMemory(markers, descriptors, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m2");
  });

  it("should filter by anatomical region", () => {
    const filters: MarkerFilter = { regions: ["lower-back", "right-knee"] };
    const result = filterMarkersInMemory(markers, descriptors, filters);
    expect(result).toHaveLength(2);
    expect(result.map((m) => m.id).sort()).toEqual(["m2", "m3"]);
  });

  it("should combine multiple filters (AND logic)", () => {
    const filters: MarkerFilter = {
      intensityRange: { min: 6, max: 10 },
      painTypes: ["burning"],
    };
    const result = filterMarkersInMemory(markers, descriptors, filters);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m2");
  });

  it("should return empty when no markers match", () => {
    const filters: MarkerFilter = { intensityRange: { min: 11, max: 15 } };
    const result = filterMarkersInMemory(markers, descriptors, filters);
    expect(result).toHaveLength(0);
  });

  it("should exclude markers without a descriptor when filtering by pain type", () => {
    const filters: MarkerFilter = { painTypes: ["sharp"] };
    const result = filterMarkersInMemory(markers, [], filters);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getBodyMap (DB-backed, mocked pool)
// ---------------------------------------------------------------------------

describe("getBodyMap", () => {
  it("should aggregate sessions, markers, and descriptors for a user", async () => {
    const mockClient = {
      query: vi.fn().mockImplementation((sql: string, params?: any[]) => {
        if (sql.includes("pain_sessions")) {
          return {
            rows: [
              {
                id: "s1",
                user_id: "user-1",
                status: "completed",
                created_at: new Date("2024-06-01"),
                updated_at: new Date("2024-06-01"),
              },
            ],
          };
        }
        if (sql.includes("pain_markers")) {
          return {
            rows: [
              {
                id: "m1",
                session_id: "s1",
                region_id: "left-shoulder",
                region_name: "Left Shoulder",
                coordinates: { x: 1, y: 2, z: 3 },
                boundary: null,
                intensity: 5,
                status: "active",
                created_at: new Date("2024-06-01"),
              },
            ],
          };
        }
        if (sql.includes("symptom_descriptors")) {
          return {
            rows: [
              {
                id: "d1",
                marker_id: "m1",
                pain_type: "sharp",
                intensity: 5,
                frequency: "intermittent",
                duration: "hours",
                completed_at: new Date("2024-06-01"),
              },
            ],
          };
        }
        if (sql.includes("follow_up_responses")) {
          return {
            rows: [
              {
                descriptor_id: "d1",
                question_id: "q1",
                question_text: "When did it start?",
                response: "Last week",
                answered_at: new Date("2024-06-01"),
              },
            ],
          };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };
    const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as any;

    const bodyMap = await getBodyMap("user-1", mockPool);

    expect(bodyMap.userId).toBe("user-1");
    expect(bodyMap.sessions).toHaveLength(1);
    expect(bodyMap.markers).toHaveLength(1);
    expect(bodyMap.markers[0].location.region.name).toBe("Left Shoulder");
    expect(bodyMap.descriptors).toHaveLength(1);
    expect(bodyMap.descriptors[0].followUpResponses).toHaveLength(1);
    expect(bodyMap.descriptors[0].followUpResponses[0].response).toBe("Last week");
  });

  it("should return empty body map for user with no sessions", async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as any;

    const bodyMap = await getBodyMap("user-empty", mockPool);

    expect(bodyMap.userId).toBe("user-empty");
    expect(bodyMap.sessions).toHaveLength(0);
    expect(bodyMap.markers).toHaveLength(0);
    expect(bodyMap.descriptors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterMarkers (DB-backed, mocked pool)
// ---------------------------------------------------------------------------

describe("filterMarkers", () => {
  it("should build a query with date range and intensity filters", async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as any;

    await filterMarkers(
      "user-1",
      {
        dateRange: { start: new Date("2024-01-01"), end: new Date("2024-12-31") },
        intensityRange: { min: 3, max: 8 },
      },
      mockPool
    );

    const sql: string = mockClient.query.mock.calls[0][0];
    expect(sql).toContain("ps.user_id = $1");
    expect(sql).toContain("pm.created_at >= $2");
    expect(sql).toContain("pm.created_at <= $3");
    expect(sql).toContain("pm.intensity >= $4");
    expect(sql).toContain("pm.intensity <= $5");
  });

  it("should join symptom_descriptors when filtering by pain type", async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as any;

    await filterMarkers("user-1", { painTypes: ["sharp", "burning"] }, mockPool);

    const sql: string = mockClient.query.mock.calls[0][0];
    expect(sql).toContain("JOIN symptom_descriptors sd ON sd.marker_id = pm.id");
    expect(sql).toContain("sd.pain_type = ANY");
  });

  it("should filter by region", async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as any;

    await filterMarkers("user-1", { regions: ["lower-back"] }, mockPool);

    const sql: string = mockClient.query.mock.calls[0][0];
    expect(sql).toContain("pm.region_id = ANY");
  });

  it("should map returned rows to PainMarker objects", async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "m1",
            session_id: "s1",
            region_id: "chest",
            region_name: "Chest",
            coordinates: { x: 0, y: 0, z: 1 },
            boundary: null,
            intensity: 6,
            status: "active",
            created_at: new Date("2024-06-01"),
          },
        ],
      }),
      release: vi.fn(),
    };
    const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as any;

    const result = await filterMarkers("user-1", {}, mockPool);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("m1");
    expect(result[0].location.region.id).toBe("chest");
    expect(result[0].intensity).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// getMarkersByRegion (DB-backed, mocked pool)
// ---------------------------------------------------------------------------

describe("getMarkersByRegion", () => {
  it("should query markers by region_id for a user", async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            id: "m1",
            session_id: "s1",
            region_id: "lower-back",
            region_name: "Lower Back",
            coordinates: { x: 0, y: 1, z: 0 },
            boundary: null,
            intensity: 8,
            status: "active",
            created_at: new Date("2024-06-01"),
          },
        ],
      }),
      release: vi.fn(),
    };
    const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as any;

    const region = { id: "lower-back", name: "Lower Back", bodySystem: "musculoskeletal" };
    const result = await getMarkersByRegion("user-1", region, mockPool);

    expect(result).toHaveLength(1);
    expect(result[0].location.region.id).toBe("lower-back");

    // Verify the query used the correct params
    const params = mockClient.query.mock.calls[0][1];
    expect(params[0]).toBe("user-1");
    expect(params[1]).toBe("lower-back");
  });

  it("should return empty array when no markers exist for the region", async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    };
    const mockPool = { connect: vi.fn().mockResolvedValue(mockClient) } as any;

    const region = { id: "right-knee", name: "Right Knee", bodySystem: "musculoskeletal" };
    const result = await getMarkersByRegion("user-1", region, mockPool);

    expect(result).toHaveLength(0);
  });
});
