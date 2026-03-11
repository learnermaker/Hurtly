/**
 * API Client Service
 * 
 * Provides methods for all REST API endpoints with error handling,
 * offline detection, and fallback to offline cache.
 * 
 * Validates: Requirements 8.5, 5.2, 6.1, 7.1
 */

import type {
  PainSession,
  PainMarker,
  SymptomDescriptor,
  BodyMap,
  MarkerFilter,
  TimelineData,
  AnatomicalRegion,
  InsightReport,
  FollowUpQuestion,
} from "@bodytrace/shared";
import { cacheSession, syncCachedSessions } from "./offline-cache";

export interface ApiClientConfig {
  baseUrl: string;
  authToken?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public response?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class OfflineError extends Error {
  constructor(message: string = "Network unavailable") {
    super(message);
    this.name = "OfflineError";
  }
}

/**
 * Check if the browser is online
 */
function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * API Client for BodyTrace backend
 */
export class ApiClient {
  private baseUrl: string;
  private authToken?: string;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.authToken = config.authToken;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Make an HTTP request with error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Check online status
    if (!isOnline()) {
      throw new OfflineError();
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle non-2xx responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData
        );
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return undefined as T;
      }

      return await response.json();
    } catch (error) {
      // Network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new OfflineError("Network request failed");
      }
      throw error;
    }
  }

  // ==================== Pain Session Methods ====================

  /**
   * Create a new pain session
   * POST /api/pain-sessions
   */
  async createSession(userId: string): Promise<PainSession> {
    try {
      return await this.request<PainSession>("/api/pain-sessions", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
    } catch (error) {
      if (error instanceof OfflineError) {
        // Create session locally and cache it
        const session: PainSession = {
          id: crypto.randomUUID(),
          userId,
          markers: [],
          descriptors: [],
          status: "in-progress",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await cacheSession(session);
        return session;
      }
      throw error;
    }
  }

  /**
   * Get a pain session by ID
   * GET /api/pain-sessions/:sessionId
   */
  async getSession(sessionId: string): Promise<PainSession> {
    return await this.request<PainSession>(`/api/pain-sessions/${sessionId}`);
  }

  /**
   * Update/save a pain session
   * PUT /api/pain-sessions/:sessionId
   */
  async saveSession(sessionId: string): Promise<{ message: string; sessionId: string }> {
    return await this.request(`/api/pain-sessions/${sessionId}`, {
      method: "PUT",
    });
  }

  /**
   * Add a pain marker to a session
   * POST /api/pain-sessions/:sessionId/markers
   */
  async addMarker(sessionId: string, marker: PainMarker): Promise<{ message: string; marker: PainMarker }> {
    try {
      return await this.request(`/api/pain-sessions/${sessionId}/markers`, {
        method: "POST",
        body: JSON.stringify(marker),
      });
    } catch (error) {
      if (error instanceof OfflineError) {
        // Cache the marker addition locally
        // This would require updating the cached session
        throw new OfflineError("Cannot add marker while offline. Please reconnect.");
      }
      throw error;
    }
  }

  /**
   * Add a symptom descriptor to a session
   * POST /api/pain-sessions/:sessionId/descriptors
   */
  async addDescriptor(
    sessionId: string,
    descriptor: SymptomDescriptor
  ): Promise<{ message: string; descriptor: SymptomDescriptor }> {
    try {
      return await this.request(`/api/pain-sessions/${sessionId}/descriptors`, {
        method: "POST",
        body: JSON.stringify(descriptor),
      });
    } catch (error) {
      if (error instanceof OfflineError) {
        throw new OfflineError("Cannot add descriptor while offline. Please reconnect.");
      }
      throw error;
    }
  }

  // ==================== Body Map Methods ====================

  /**
   * Get body map for a user
   * GET /api/body-map/:userId
   */
  async getBodyMap(userId: string): Promise<BodyMap> {
    return await this.request<BodyMap>(`/api/body-map/${userId}`);
  }

  /**
   * Filter body map markers
   * POST /api/body-map/:userId/filter
   */
  async filterBodyMap(userId: string, filters: MarkerFilter): Promise<{ markers: PainMarker[]; count: number }> {
    return await this.request<{ markers: PainMarker[]; count: number }>(`/api/body-map/${userId}/filter`, {
      method: "POST",
      body: JSON.stringify(filters),
    });
  }

  /**
   * Get markers for a specific region
   * GET /api/body-map/:userId/region/:regionId
   */
  async getMarkersByRegion(userId: string, region: AnatomicalRegion): Promise<{ region: AnatomicalRegion; markers: PainMarker[]; count: number }> {
    const params = new URLSearchParams({
      regionName: region.name,
    });
    return await this.request<{ region: AnatomicalRegion; markers: PainMarker[]; count: number }>(
      `/api/body-map/${userId}/region/${region.id}?${params}`
    );
  }

  // ==================== Timeline Methods ====================

  /**
   * Get timeline data for a specific region
   * GET /api/timeline/:userId/region/:regionId
   */
  async getTimeline(userId: string, region: AnatomicalRegion): Promise<TimelineData & { trend: string | null; entryCount: number }> {
    const params = new URLSearchParams({
      regionName: region.name,
    });
    return await this.request<TimelineData & { trend: string | null; entryCount: number }>(
      `/api/timeline/${userId}/region/${region.id}?${params}`
    );
  }

  // ==================== Insight Report Methods ====================

  /**
   * Generate an insight report
   * POST /api/insight-reports/:userId
   */
  async generateInsightReport(userId: string): Promise<InsightReport> {
    return await this.request<InsightReport>(`/api/insight-reports/${userId}`, {
      method: "POST",
    });
  }

  /**
   * Export insight report as PDF
   * POST /api/insight-reports/:userId/export
   */
  async exportReportPDF(userId: string): Promise<Blob> {
    const url = `${this.baseUrl}/api/insight-reports/${userId}/export`;
    const headers: HeadersInit = {};

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, { 
      method: "POST",
      headers 
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.error || `HTTP ${response.status}`,
        response.status,
        errorData
      );
    }

    return await response.blob();
  }

  // ==================== Follow-Up Question Methods ====================

  /**
   * Generate follow-up questions for a descriptor
   * POST /api/follow-up/questions
   */
  async generateFollowUpQuestions(
    descriptor: SymptomDescriptor,
    userId?: string
  ): Promise<{ questions: FollowUpQuestion[]; count: number }> {
    return await this.request<{ questions: FollowUpQuestion[]; count: number }>(
      "/api/follow-up/questions",
      {
        method: "POST",
        body: JSON.stringify({ descriptor, userId }),
      }
    );
  }

  /**
   * Get default fallback questions
   * GET /api/follow-up/default-questions
   */
  async getDefaultQuestions(): Promise<{ questions: FollowUpQuestion[]; count: number }> {
    return await this.request<{ questions: FollowUpQuestion[]; count: number }>(
      "/api/follow-up/default-questions"
    );
  }

  // ==================== Data Deletion Methods ====================

  /**
   * Request data deletion for a user
   * POST /api/users/:userId/delete
   */
  async requestDataDeletion(userId: string): Promise<{ message: string; requestId: string }> {
    return await this.request<{ message: string; requestId: string }>(
      `/api/users/${userId}/delete`,
      {
        method: "POST",
      }
    );
  }

  /**
   * Verify data deletion status
   * GET /api/users/:userId/delete/:requestId
   */
  async verifyDataDeletion(userId: string, requestId: string): Promise<{ status: string; completedAt?: Date }> {
    return await this.request<{ status: string; completedAt?: Date }>(
      `/api/users/${userId}/delete/${requestId}`
    );
  }

  // ==================== Offline Sync Methods ====================

  /**
   * Sync cached sessions when connectivity is restored
   */
  async syncOfflineCache(): Promise<{ synced: string[]; failed: string[]; conflicts: string[] }> {
    return await syncCachedSessions(this.baseUrl);
  }
}

/**
 * Create a singleton API client instance
 */
let apiClientInstance: ApiClient | null = null;

export function createApiClient(config: ApiClientConfig): ApiClient {
  apiClientInstance = new ApiClient(config);
  return apiClientInstance;
}

export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    throw new Error("API client not initialized. Call createApiClient first.");
  }
  return apiClientInstance;
}

/**
 * Setup connectivity restore listener to trigger sync
 */
export function setupOfflineSyncListener(apiClient: ApiClient): void {
  window.addEventListener("online", async () => {
    console.log("Connectivity restored. Syncing offline cache...");
    try {
      const result = await apiClient.syncOfflineCache();
      console.log("Sync complete:", result);
      
      // Notify user of sync results
      if (result.synced.length > 0) {
        console.log(`Successfully synced ${result.synced.length} sessions`);
      }
      if (result.conflicts.length > 0) {
        console.warn(`${result.conflicts.length} sessions had conflicts (server data preserved)`);
      }
      if (result.failed.length > 0) {
        console.error(`${result.failed.length} sessions failed to sync`);
      }
    } catch (error) {
      console.error("Failed to sync offline cache:", error);
    }
  });
}
