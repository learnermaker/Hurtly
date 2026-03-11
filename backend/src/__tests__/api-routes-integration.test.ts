import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { v4 as uuidv4 } from "uuid";
import { AuditLogger } from "../services/audit-logger.js";
import { createApiRouter } from "../routes/index.js";
import * as PainSessionManager from "../services/pain-session-manager.js";
import defaultPool from "../db/index.js";
import type { PainMarker, SymptomDescriptor } from "@bodytrace/shared";

/**
 * Integration tests for REST API routes
 * 
 * Tests the complete API surface including:
 * - Pain session CRUD operations
 * - Body map retrieval and filtering
 * - Timeline data retrieval
 * - Insight report generation
 * - Follow-up question generation
 * - Data deletion
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 5.1, 5.5, 6.1, 7.1, 7.4, 9.3, 9.5
 */

describe("API Routes Integration Tests", () => {
  let app: express.Application;
  const testUserId = uuidv4(); // Use a proper UUID for the test user
  const authToken = `user-${testUserId}`; // Auth token format expected by middleware

  // Helper to create authenticated request
  const authRequest = (method: "get" | "post" | "put" | "delete", url: string) => {
    return request(app)[method](url).set("Authorization", `Bearer ${authToken}`);
  };

  // Helper to create a test marker
  const createTestMarker = (sessionId: string, intensity: number = 7): PainMarker => ({
    id: uuidv4(),
    sessionId,
    location: {
      region: { id: "left-shoulder", name: "Left Shoulder", bodySystem: "musculoskeletal" },
      coordinates: { x: 0, y: 1, z: 0 },
    },
    intensity,
    createdAt: new Date(),
    status: "active",
  });

  // Helper to create a test descriptor
  const createTestDescriptor = (markerId: string): SymptomDescriptor => ({
    id: uuidv4(),
    markerId,
    painType: "sharp",
    intensity: 7,
    frequency: "intermittent",
    duration: "hours",
    followUpResponses: [],
    completedAt: new Date(),
  });

  beforeEach(async () => {
    // Set up Express app with routes
    app = express();
    app.use(express.json());
    
    const auditLogger = new AuditLogger();
    app.use("/api", createApiRouter(auditLogger));

    // Clean up test data and create test user
    PainSessionManager.clearActiveSessions();
    const client = await defaultPool.connect();
    try {
      await client.query("DELETE FROM pain_sessions WHERE user_id = $1", [testUserId]);
      // Create test user if it doesn't exist
      await client.query(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (id) DO NOTHING",
        [testUserId, "test@example.com", "test-hash"]
      );
    } finally {
      client.release();
    }
  });

  afterEach(async () => {
    // Clean up test data
    PainSessionManager.clearActiveSessions();
    const client = await defaultPool.connect();
    try {
      await client.query("DELETE FROM pain_sessions WHERE user_id = $1", [testUserId]);
      await client.query("DELETE FROM users WHERE id = $1", [testUserId]);
    } finally {
      client.release();
    }
  });

  describe("Pain Session Routes", () => {
    it("should create a new pain session", async () => {
      const response = await authRequest("post", "/api/pain-sessions")
        .send({ userId: testUserId })
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.userId).toBe(testUserId);
      expect(response.body.status).toBe("in-progress");
      expect(response.body.markers).toEqual([]);
      expect(response.body.descriptors).toEqual([]);
    });

    it("should add a marker to a session", async () => {
      // Create session
      const createResponse = await authRequest("post", "/api/pain-sessions")
        .send({ userId: testUserId })
        .expect(201);

      const sessionId = createResponse.body.id;

      // Add marker
      const marker = createTestMarker(sessionId);

      const response = await authRequest("post", `/api/pain-sessions/${sessionId}/markers`)
        .send(marker)
        .expect(201);

      expect(response.body.message).toBe("Marker added successfully");
      expect(response.body.marker.id).toBe(marker.id);
    });

    it("should add a descriptor to a session", async () => {
      // Create session and add marker
      const createResponse = await authRequest("post", "/api/pain-sessions")
        .send({ userId: testUserId })
        .expect(201);

      const sessionId = createResponse.body.id;

      const marker = createTestMarker(sessionId);

      await authRequest("post", `/api/pain-sessions/${sessionId}/markers`)
        .send(marker)
        .expect(201);

      // Add descriptor
      const descriptor = createTestDescriptor(marker.id);

      const response = await authRequest("post", `/api/pain-sessions/${sessionId}/descriptors`)
        .send(descriptor)
        .expect(201);

      expect(response.body.message).toBe("Descriptor added successfully");
      expect(response.body.descriptor.id).toBe(descriptor.id);
    });

    it("should save and retrieve a session", async () => {
      // Create session with marker and descriptor
      const createResponse = await authRequest("post", "/api/pain-sessions")
        .send({ userId: testUserId })
        .expect(201);

      const sessionId = createResponse.body.id;

      const marker = createTestMarker(sessionId);

      await authRequest("post", `/api/pain-sessions/${sessionId}/markers`)
        .send(marker)
        .expect(201);

      const descriptor = createTestDescriptor(marker.id);

      await authRequest("post", `/api/pain-sessions/${sessionId}/descriptors`)
        .send(descriptor)
        .expect(201);

      // Save session
      await authRequest("put", `/api/pain-sessions/${sessionId}`)
        .expect(200);

      // Retrieve session
      const getResponse = await authRequest("get", `/api/pain-sessions/${sessionId}`)
        .expect(200);

      expect(getResponse.body.id).toBe(sessionId);
      expect(getResponse.body.markers).toHaveLength(1);
      expect(getResponse.body.descriptors).toHaveLength(1);
      expect(getResponse.body.status).toBe("completed");
    });
  });

  describe("Body Map Routes", () => {
    it("should retrieve an empty body map for a new user", async () => {
      const response = await authRequest("get", `/api/body-map/${testUserId}`)
        .expect(200);

      expect(response.body.userId).toBe(testUserId);
      expect(response.body.sessions).toEqual([]);
      expect(response.body.markers).toEqual([]);
      expect(response.body.descriptors).toEqual([]);
    });

    it("should retrieve body map with saved sessions", async () => {
      // Create and save a session
      const createResponse = await authRequest("post", "/api/pain-sessions")
        .send({ userId: testUserId })
        .expect(201);

      const sessionId = createResponse.body.id;

      const marker = createTestMarker(sessionId);

      await authRequest("post", `/api/pain-sessions/${sessionId}/markers`)
        .send(marker)
        .expect(201);

      await authRequest("put", `/api/pain-sessions/${sessionId}`)
        .expect(200);

      // Retrieve body map
      const response = await authRequest("get", `/api/body-map/${testUserId}`)
        .expect(200);

      expect(response.body.userId).toBe(testUserId);
      expect(response.body.sessions).toHaveLength(1);
      expect(response.body.markers).toHaveLength(1);
    });

    it("should filter markers by intensity range", async () => {
      // Create sessions with different intensities
      for (let i = 0; i < 3; i++) {
        const createResponse = await authRequest("post", "/api/pain-sessions")
          .send({ userId: testUserId })
          .expect(201);

        const sessionId = createResponse.body.id;

        const marker = createTestMarker(sessionId, (i + 1) * 3); // 3, 6, 9

        await authRequest("post", `/api/pain-sessions/${sessionId}/markers`)
          .send(marker)
          .expect(201);

        await authRequest("put", `/api/pain-sessions/${sessionId}`)
          .expect(200);
      }

      // Filter for intensity 5-8
      const response = await authRequest("post", `/api/body-map/${testUserId}/filter`)
        .send({
          intensityRange: { min: 5, max: 8 },
        })
        .expect(200);

      expect(response.body.markers).toHaveLength(1);
      expect(response.body.markers[0].intensity).toBe(6);
    });
  });

  describe("Follow-Up Routes", () => {
    it("should generate follow-up questions for a descriptor", async () => {
      const descriptor = createTestDescriptor(uuidv4());

      const response = await authRequest("post", "/api/follow-up/questions")
        .send({ descriptor })
        .expect(200);

      expect(response.body.questions).toBeDefined();
      expect(response.body.questions.length).toBeGreaterThan(0);
      expect(response.body.questions[0]).toHaveProperty("id");
      expect(response.body.questions[0]).toHaveProperty("text");
      expect(response.body.questions[0]).toHaveProperty("context");
    });

    it("should get default fallback questions", async () => {
      const response = await authRequest("get", "/api/follow-up/default-questions")
        .expect(200);

      expect(response.body.questions).toBeDefined();
      expect(response.body.questions.length).toBeGreaterThan(0);
    });
  });

  describe("Insight Report Routes", () => {
    it("should generate an insight report", async () => {
      // Create a session with data
      const createResponse = await authRequest("post", "/api/pain-sessions")
        .send({ userId: testUserId })
        .expect(201);

      const sessionId = createResponse.body.id;

      const marker = createTestMarker(sessionId);

      await authRequest("post", `/api/pain-sessions/${sessionId}/markers`)
        .send(marker)
        .expect(201);

      const descriptor = createTestDescriptor(marker.id);

      await authRequest("post", `/api/pain-sessions/${sessionId}/descriptors`)
        .send(descriptor)
        .expect(201);

      await authRequest("put", `/api/pain-sessions/${sessionId}`)
        .expect(200);

      // Generate report
      const response = await authRequest("post", `/api/insight-reports/${testUserId}`)
        .expect(200);

      expect(response.body).toHaveProperty("id");
      expect(response.body.userId).toBe(testUserId);
      expect(response.body).toHaveProperty("patterns");
      expect(response.body).toHaveProperty("frequencyTrends");
      expect(response.body).toHaveProperty("intensityChanges");
      expect(response.body).toHaveProperty("disclaimer");
      expect(response.body.disclaimer).toContain("informational");
    });
  });

  describe("Data Deletion Routes", () => {
    it("should delete all user data", async () => {
      // Create a session
      const createResponse = await authRequest("post", "/api/pain-sessions")
        .send({ userId: testUserId })
        .expect(201);

      const sessionId = createResponse.body.id;

      const marker = createTestMarker(sessionId);

      await authRequest("post", `/api/pain-sessions/${sessionId}/markers`)
        .send(marker)
        .expect(201);

      await authRequest("put", `/api/pain-sessions/${sessionId}`)
        .expect(200);

      // Verify data exists
      const bodyMapBefore = await authRequest("get", `/api/body-map/${testUserId}`)
        .expect(200);

      expect(bodyMapBefore.body.sessions).toHaveLength(1);

      // Delete data
      await authRequest("delete", `/api/users/${testUserId}/data`)
        .expect(200);

      // Verify deletion
      const verifyResponse = await authRequest("get", `/api/users/${testUserId}/data/verify-deletion`)
        .expect(200);

      expect(verifyResponse.body.isDeleted).toBe(true);

      // Verify body map is empty
      const bodyMapAfter = await authRequest("get", `/api/body-map/${testUserId}`)
        .expect(200);

      expect(bodyMapAfter.body.sessions).toHaveLength(0);
      expect(bodyMapAfter.body.markers).toHaveLength(0);
    });
  });
});
