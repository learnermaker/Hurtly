/**
 * API Client Integration Tests
 * 
 * Tests the API client service with error handling, offline detection,
 * and proper HTTP status code handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ApiClient, ApiError, OfflineError, createApiClient } from "../api-client";
import type { PainSession, PainMarker, SymptomDescriptor, MarkerFilter } from "@bodytrace/shared";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  writable: true,
  value: true,
});

// Mock offline cache
vi.mock("../offline-cache", () => ({
  cacheSession: vi.fn(),
  syncCachedSessions: vi.fn().mockResolvedValue({
    synced: [],
    failed: [],
    conflicts: [],
  }),
}));

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    client = createApiClient({
      baseUrl: "http://localhost:3000",
      authToken: "test-token",
    });
    mockFetch.mockClear();
    (navigator as { onLine: boolean }).onLine = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Pain Session Methods", () => {
    it("should create a new session", async () => {
      const mockSession: PainSession = {
        id: "session-1",
        userId: "user-1",
        markers: [],
        descriptors: [],
        status: "in-progress",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockSession,
      });

      const result = await client.createSession("user-1");

      expect(result).toEqual(mockSession);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/pain-sessions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          }),
          body: JSON.stringify({ userId: "user-1" }),
        })
      );
    });

    it("should get a session by ID", async () => {
      const mockSession: PainSession = {
        id: "session-1",
        userId: "user-1",
        markers: [],
        descriptors: [],
        status: "completed",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSession,
      });

      const result = await client.getSession("session-1");

      expect(result).toEqual(mockSession);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/pain-sessions/session-1",
        expect.any(Object)
      );
    });

    it("should save a session", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "Session saved successfully", sessionId: "session-1" }),
      });

      const result = await client.saveSession("session-1");

      expect(result.message).toBe("Session saved successfully");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/pain-sessions/session-1",
        expect.objectContaining({
          method: "PUT",
        })
      );
    });

    it("should add a marker to a session", async () => {
      const mockMarker: PainMarker = {
        id: "marker-1",
        sessionId: "session-1",
        location: {
          region: { id: "chest", name: "Chest", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 1.2, z: 0.075 },
        },
        intensity: 7,
        createdAt: new Date(),
        status: "active",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ message: "Marker added successfully", marker: mockMarker }),
      });

      const result = await client.addMarker("session-1", mockMarker);

      expect(result.marker).toEqual(mockMarker);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/pain-sessions/session-1/markers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(mockMarker),
        })
      );
    });

    it("should add a descriptor to a session", async () => {
      const mockDescriptor: SymptomDescriptor = {
        id: "desc-1",
        markerId: "marker-1",
        painType: "sharp",
        intensity: 7,
        frequency: "intermittent",
        duration: "hours",
        followUpResponses: [],
        completedAt: new Date(),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ message: "Descriptor added successfully", descriptor: mockDescriptor }),
      });

      const result = await client.addDescriptor("session-1", mockDescriptor);

      expect(result.descriptor).toEqual(mockDescriptor);
    });
  });

  describe("Body Map Methods", () => {
    it("should get body map for a user", async () => {
      const mockBodyMap = {
        userId: "user-1",
        sessions: [],
        markers: [],
        descriptors: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockBodyMap,
      });

      const result = await client.getBodyMap("user-1");

      expect(result).toEqual(mockBodyMap);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/body-map/user-1",
        expect.any(Object)
      );
    });

    it("should filter body map markers", async () => {
      const filters: MarkerFilter = {
        intensityRange: { min: 5, max: 10 },
        painTypes: ["sharp", "burning"],
      };

      const mockResponse = {
        markers: [],
        count: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.filterBodyMap("user-1", filters);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/body-map/user-1/filter",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(filters),
        })
      );
    });

    it("should get markers by region", async () => {
      const region = { id: "chest", name: "Chest", bodySystem: "musculoskeletal" as const };
      const mockResponse = {
        region,
        markers: [],
        count: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getMarkersByRegion("user-1", region);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/body-map/user-1/region/chest"),
        expect.any(Object)
      );
    });
  });

  describe("Timeline Methods", () => {
    it("should get timeline data for a region", async () => {
      const region = { id: "chest", name: "Chest", bodySystem: "musculoskeletal" as const };
      const mockTimeline = {
        region,
        entries: [],
        trend: null,
        entryCount: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTimeline,
      });

      const result = await client.getTimeline("user-1", region);

      expect(result).toEqual(mockTimeline);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/timeline/user-1/region/chest"),
        expect.any(Object)
      );
    });
  });

  describe("Insight Report Methods", () => {
    it("should generate an insight report", async () => {
      const mockReport = {
        id: "report-1",
        userId: "user-1",
        generatedAt: new Date(),
        patterns: [],
        frequencyTrends: [],
        intensityChanges: [],
        disclaimer: "This report is informational and does not constitute medical advice.",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockReport,
      });

      const result = await client.generateInsightReport("user-1");

      expect(result).toEqual(mockReport);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/insight-reports/user-1",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should export report as PDF", async () => {
      const mockBlob = new Blob(["PDF content"], { type: "application/pdf" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: async () => mockBlob,
      });

      const result = await client.exportReportPDF("user-1");

      expect(result).toBeInstanceOf(Blob);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/insight-reports/user-1/export",
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  describe("Follow-Up Question Methods", () => {
    it("should generate follow-up questions", async () => {
      const descriptor: SymptomDescriptor = {
        id: "desc-1",
        markerId: "marker-1",
        painType: "sharp",
        intensity: 7,
        frequency: "intermittent",
        duration: "hours",
        followUpResponses: [],
        completedAt: new Date(),
      };

      const mockResponse = {
        questions: [
          {
            id: "q1",
            text: "Does the pain worsen with movement?",
            context: { painType: "sharp" as const, region: { id: "chest", name: "Chest", bodySystem: "musculoskeletal" as const } },
          },
        ],
        count: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.generateFollowUpQuestions(descriptor, "user-1");

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/follow-up/questions",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ descriptor, userId: "user-1" }),
        })
      );
    });

    it("should get default questions", async () => {
      const mockResponse = {
        questions: [],
        count: 0,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await client.getDefaultQuestions();

      expect(result).toEqual(mockResponse);
    });
  });

  describe("Error Handling", () => {
    it("should throw ApiError on 404", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "Session not found" }),
      } as Response);

      await expect(client.getSession("nonexistent")).rejects.toThrow(ApiError);
    });

    it("should throw ApiError on 401 Unauthorized", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      });

      await expect(client.getBodyMap("user-1")).rejects.toThrow(ApiError);
    });

    it("should throw ApiError on 500 Internal Server Error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });

      await expect(client.getBodyMap("user-1")).rejects.toThrow(ApiError);
    });

    it("should throw OfflineError when navigator.onLine is false", async () => {
      (navigator as { onLine: boolean }).onLine = false;

      await expect(client.getSession("session-1")).rejects.toThrow(OfflineError);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should throw OfflineError on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(client.getSession("session-1")).rejects.toThrow(OfflineError);
    });
  });

  describe("Offline Fallback", () => {
    it("should cache session locally when offline during creation", async () => {
      (navigator as { onLine: boolean }).onLine = false;

      const result = await client.createSession("user-1");

      expect(result).toHaveProperty("id");
      expect(result.userId).toBe("user-1");
      expect(result.status).toBe("in-progress");
    });

    it("should throw OfflineError when adding marker offline", async () => {
      (navigator as { onLine: boolean }).onLine = false;

      const marker: PainMarker = {
        id: "marker-1",
        sessionId: "session-1",
        location: {
          region: { id: "chest", name: "Chest", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 1.2, z: 0.075 },
        },
        intensity: 7,
        createdAt: new Date(),
        status: "active",
      };

      await expect(client.addMarker("session-1", marker)).rejects.toThrow(OfflineError);
    });
  });

  describe("Authentication", () => {
    it("should include Authorization header when token is set", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await client.getBodyMap("user-1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should not include Authorization header when token is not set", async () => {
      const clientWithoutAuth = new ApiClient({ baseUrl: "http://localhost:3000" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await clientWithoutAuth.getBodyMap("user-1");

      const callArgs = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it("should update token with setAuthToken", async () => {
      const newClient = new ApiClient({ baseUrl: "http://localhost:3000" });
      newClient.setAuthToken("new-token");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      await newClient.getBodyMap("user-1");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer new-token",
          }),
        })
      );
    });
  });
});
