import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { requireAuth } from "../middleware/auth.js";

describe("Authentication Integration Tests", () => {
  let app: Express;

  beforeAll(() => {
    // Create a test Express app with protected endpoints
    app = express();
    app.use(express.json());

    // Public endpoint
    app.get("/api/health", (_req, res) => {
      res.json({ status: "ok" });
    });

    // Protected Body Map endpoints
    app.get("/api/body-map/:userId", requireAuth, (_req, res) => {
      res.json({ data: "body map data" });
    });

    app.post("/api/body-map/:userId/filter", requireAuth, (_req, res) => {
      res.json({ data: "filtered markers" });
    });

    // Protected Pain Session endpoints
    app.post("/api/pain-sessions", requireAuth, (_req, res) => {
      res.json({ sessionId: "test-session" });
    });

    app.get("/api/pain-sessions/:sessionId", requireAuth, (_req, res) => {
      res.json({ data: "session data" });
    });

    app.put("/api/pain-sessions/:sessionId", requireAuth, (_req, res) => {
      res.json({ data: "updated session" });
    });

    app.post("/api/pain-sessions/:sessionId/markers", requireAuth, (_req, res) => {
      res.json({ data: "marker added" });
    });
  });

  describe("Public endpoints", () => {
    it("should allow access to health check without authentication", async () => {
      const response = await request(app).get("/api/health");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "ok" });
    });
  });

  describe("Protected Body Map endpoints", () => {
    it("should return 401 for GET /api/body-map/:userId without auth", async () => {
      const response = await request(app).get("/api/body-map/user-123");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
      expect(response.body.data).toBeUndefined();
    });

    it("should return 401 for POST /api/body-map/:userId/filter without auth", async () => {
      const response = await request(app)
        .post("/api/body-map/user-123/filter")
        .send({ filters: {} });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
      expect(response.body.data).toBeUndefined();
    });

    it("should allow access to GET /api/body-map/:userId with valid auth", async () => {
      const response = await request(app)
        .get("/api/body-map/user-123")
        .set("Authorization", "Bearer user-123");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: "body map data" });
    });

    it("should allow access to POST /api/body-map/:userId/filter with valid auth", async () => {
      const response = await request(app)
        .post("/api/body-map/user-123/filter")
        .set("Authorization", "Bearer user-123")
        .send({ filters: {} });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: "filtered markers" });
    });
  });

  describe("Protected Pain Session endpoints", () => {
    it("should return 401 for POST /api/pain-sessions without auth", async () => {
      const response = await request(app)
        .post("/api/pain-sessions")
        .send({ userId: "user-123" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
      expect(response.body.data).toBeUndefined();
    });

    it("should return 401 for GET /api/pain-sessions/:sessionId without auth", async () => {
      const response = await request(app).get("/api/pain-sessions/session-123");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
      expect(response.body.data).toBeUndefined();
    });

    it("should return 401 for PUT /api/pain-sessions/:sessionId without auth", async () => {
      const response = await request(app)
        .put("/api/pain-sessions/session-123")
        .send({ status: "completed" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
      expect(response.body.data).toBeUndefined();
    });

    it("should return 401 for POST /api/pain-sessions/:sessionId/markers without auth", async () => {
      const response = await request(app)
        .post("/api/pain-sessions/session-123/markers")
        .send({ marker: {} });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
      expect(response.body.data).toBeUndefined();
    });

    it("should allow access to POST /api/pain-sessions with valid auth", async () => {
      const response = await request(app)
        .post("/api/pain-sessions")
        .set("Authorization", "Bearer user-123")
        .send({ userId: "user-123" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ sessionId: "test-session" });
    });

    it("should allow access to GET /api/pain-sessions/:sessionId with valid auth", async () => {
      const response = await request(app)
        .get("/api/pain-sessions/session-123")
        .set("Authorization", "Bearer user-123");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: "session data" });
    });

    it("should allow access to PUT /api/pain-sessions/:sessionId with valid auth", async () => {
      const response = await request(app)
        .put("/api/pain-sessions/session-123")
        .set("Authorization", "Bearer user-123")
        .send({ status: "completed" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: "updated session" });
    });

    it("should allow access to POST /api/pain-sessions/:sessionId/markers with valid auth", async () => {
      const response = await request(app)
        .post("/api/pain-sessions/session-123/markers")
        .set("Authorization", "Bearer user-123")
        .send({ marker: {} });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: "marker added" });
    });
  });

  describe("Validates: Requirements 9.3 - No data in unauthorized responses", () => {
    it("should not leak any data in 401 responses", async () => {
      const endpoints = [
        { method: "get", path: "/api/body-map/user-123" },
        { method: "post", path: "/api/body-map/user-123/filter" },
        { method: "post", path: "/api/pain-sessions" },
        { method: "get", path: "/api/pain-sessions/session-123" },
        { method: "put", path: "/api/pain-sessions/session-123" },
        { method: "post", path: "/api/pain-sessions/session-123/markers" },
      ];

      for (const endpoint of endpoints) {
        const response = await (request(app) as any)[endpoint.method](endpoint.path);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: "Unauthorized" });
        // Verify no additional fields are present
        expect(Object.keys(response.body)).toEqual(["error"]);
      }
    });
  });
});
