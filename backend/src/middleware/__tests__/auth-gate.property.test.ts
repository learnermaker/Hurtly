import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import express, { Express } from "express";
import { requireAuth } from "../auth.js";

// Feature: body-trace, Property 21: Authentication gate
// **Validates: Requirements 9.3**

describe("Property 21: Authentication gate", () => {
  let app: Express;

  beforeAll(() => {
    // Create a test Express app with protected endpoints
    app = express();
    app.use(express.json());

    // Protected Body Map endpoints
    app.get("/api/body-map/:userId", requireAuth, (_req, res) => {
      res.json({ data: "sensitive body map data", markers: [], sessions: [] });
    });

    app.post("/api/body-map/:userId/filter", requireAuth, (_req, res) => {
      res.json({ data: "filtered markers", results: [] });
    });

    app.delete("/api/body-map/:userId", requireAuth, (_req, res) => {
      res.json({ data: "body map deleted" });
    });

    // Protected Pain Session endpoints
    app.post("/api/pain-sessions", requireAuth, (_req, res) => {
      res.json({ sessionId: "test-session", data: "session created" });
    });

    app.get("/api/pain-sessions/:sessionId", requireAuth, (_req, res) => {
      res.json({ data: "session data", markers: [], descriptors: [] });
    });

    app.put("/api/pain-sessions/:sessionId", requireAuth, (_req, res) => {
      res.json({ data: "updated session", status: "completed" });
    });

    app.delete("/api/pain-sessions/:sessionId", requireAuth, (_req, res) => {
      res.json({ data: "session deleted" });
    });

    app.post("/api/pain-sessions/:sessionId/markers", requireAuth, (_req, res) => {
      res.json({ data: "marker added", markerId: "test-marker" });
    });

    // Protected Timeline endpoint
    app.get("/api/timeline/:userId/:region", requireAuth, (_req, res) => {
      res.json({ data: "timeline data", entries: [] });
    });

    // Protected Insight Report endpoint
    app.get("/api/insight-report/:userId", requireAuth, (_req, res) => {
      res.json({ data: "insight report", patterns: [], trends: [] });
    });

    app.post("/api/insight-report/:userId/export", requireAuth, (_req, res) => {
      res.json({ data: "pdf generated", url: "http://example.com/report.pdf" });
    });
  });

  it("should return 401 with no data for any unauthenticated GET request to protected endpoints", { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random endpoint paths
        fc.constantFrom(
          "/api/body-map/user-123",
          "/api/pain-sessions/session-456",
          "/api/timeline/user-123/left-shoulder",
          "/api/insight-report/user-789"
        ),
        // Generate random invalid auth headers (or none)
        fc.option(
          fc.oneof(
            fc.constant(undefined), // No header
            fc.constant(""), // Empty string
            fc.constant("InvalidFormat"), // Malformed
            fc.constant("bearer token"), // Wrong case
            fc.constant("Basic dXNlcjpwYXNz"), // Wrong auth type
            fc.string().map(s => `Bearer ${s}`).filter(s => !s.includes("user-")), // Invalid token format
            fc.constant("Bearer "), // Empty token
            fc.constant("Bearer  "), // Whitespace token
          ),
          { nil: undefined }
        ),
        async (endpoint, authHeader) => {
          const req = request(app).get(endpoint);
          
          if (authHeader) {
            req.set("Authorization", authHeader);
          }

          const response = await req;

          // Verify 401 status
          expect(response.status).toBe(401);
          
          // Verify response contains only error field, no data
          expect(response.body).toEqual({ error: "Unauthorized" });
          expect(response.body.data).toBeUndefined();
          expect(response.body.markers).toBeUndefined();
          expect(response.body.sessions).toBeUndefined();
          expect(response.body.results).toBeUndefined();
          expect(response.body.entries).toBeUndefined();
          expect(response.body.patterns).toBeUndefined();
          expect(response.body.trends).toBeUndefined();
          
          // Verify only one key exists
          expect(Object.keys(response.body)).toEqual(["error"]);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should return 401 with no data for any unauthenticated POST request to protected endpoints", { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random POST endpoint paths
        fc.constantFrom(
          "/api/body-map/user-123/filter",
          "/api/pain-sessions",
          "/api/pain-sessions/session-456/markers",
          "/api/insight-report/user-789/export"
        ),
        // Generate random request bodies
        fc.record({
          userId: fc.option(fc.uuid(), { nil: undefined }),
          filters: fc.option(fc.record({}), { nil: undefined }),
          marker: fc.option(fc.record({}), { nil: undefined }),
          data: fc.option(fc.string(), { nil: undefined }),
        }),
        // Generate random invalid auth headers
        fc.option(
          fc.oneof(
            fc.constant(undefined),
            fc.constant(""),
            fc.constant("InvalidFormat"),
            fc.string().map(s => `Bearer ${s}`).filter(s => !s.includes("user-")),
          ),
          { nil: undefined }
        ),
        async (endpoint, body, authHeader) => {
          const req = request(app).post(endpoint).send(body);
          
          if (authHeader) {
            req.set("Authorization", authHeader);
          }

          const response = await req;

          // Verify 401 status
          expect(response.status).toBe(401);
          
          // Verify response contains only error field, no data
          expect(response.body).toEqual({ error: "Unauthorized" });
          expect(response.body.data).toBeUndefined();
          expect(response.body.sessionId).toBeUndefined();
          expect(response.body.markerId).toBeUndefined();
          expect(response.body.url).toBeUndefined();
          
          // Verify only one key exists
          expect(Object.keys(response.body)).toEqual(["error"]);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should return 401 with no data for any unauthenticated PUT request to protected endpoints", { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random session IDs
        fc.uuid(),
        // Generate random request bodies
        fc.record({
          status: fc.option(fc.constantFrom("in-progress", "completed"), { nil: undefined }),
          data: fc.option(fc.string(), { nil: undefined }),
        }),
        // Generate random invalid auth headers
        fc.option(
          fc.oneof(
            fc.constant(undefined),
            fc.constant(""),
            fc.string().map(s => `Bearer ${s}`).filter(s => !s.includes("user-")),
          ),
          { nil: undefined }
        ),
        async (sessionId, body, authHeader) => {
          const endpoint = `/api/pain-sessions/${sessionId}`;
          const req = request(app).put(endpoint).send(body);
          
          if (authHeader) {
            req.set("Authorization", authHeader);
          }

          const response = await req;

          // Verify 401 status
          expect(response.status).toBe(401);
          
          // Verify response contains only error field, no data
          expect(response.body).toEqual({ error: "Unauthorized" });
          expect(response.body.data).toBeUndefined();
          expect(response.body.status).toBeUndefined();
          
          // Verify only one key exists
          expect(Object.keys(response.body)).toEqual(["error"]);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should return 401 with no data for any unauthenticated DELETE request to protected endpoints", { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random endpoint paths for DELETE
        fc.oneof(
          fc.uuid().map(id => `/api/body-map/${id}`),
          fc.uuid().map(id => `/api/pain-sessions/${id}`),
        ),
        // Generate random invalid auth headers
        fc.option(
          fc.oneof(
            fc.constant(undefined),
            fc.constant(""),
            fc.string().map(s => `Bearer ${s}`).filter(s => !s.includes("user-")),
          ),
          { nil: undefined }
        ),
        async (endpoint, authHeader) => {
          const req = request(app).delete(endpoint);
          
          if (authHeader) {
            req.set("Authorization", authHeader);
          }

          const response = await req;

          // Verify 401 status
          expect(response.status).toBe(401);
          
          // Verify response contains only error field, no data
          expect(response.body).toEqual({ error: "Unauthorized" });
          expect(response.body.data).toBeUndefined();
          
          // Verify only one key exists
          expect(Object.keys(response.body)).toEqual(["error"]);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should return 401 with no data for requests with various malformed Authorization headers", { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate various malformed auth headers (avoiding control characters that supertest rejects)
        fc.oneof(
          // Missing Bearer prefix
          fc.string().filter(s => !s.startsWith("Bearer") && !/[\r\n\t]/.test(s)),
          // Multiple spaces
          fc.string().filter(s => !/[\r\n\t]/.test(s)).map(s => `Bearer  ${s}`),
          // Wrong case variations
          fc.string().filter(s => !/[\r\n\t]/.test(s)).map(s => `bearer ${s}`),
          fc.string().filter(s => !/[\r\n\t]/.test(s)).map(s => `BEARER ${s}`),
          // Special characters only (but no control chars)
          fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/[a-zA-Z0-9]/g, '!')),
          // Very long tokens (but reasonable length to avoid timeout)
          fc.string({ minLength: 1000, maxLength: 5000 }),
        ),
        async (authHeader) => {
          const endpoint = "/api/body-map/user-123";
          const response = await request(app)
            .get(endpoint)
            .set("Authorization", authHeader);

          // Verify 401 status
          expect(response.status).toBe(401);
          
          // Verify response contains only error field, no data
          expect(response.body).toEqual({ error: "Unauthorized" });
          expect(Object.keys(response.body)).toEqual(["error"]);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should return 401 with no data for requests with random HTTP methods to protected endpoints", { timeout: 30000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random HTTP methods (excluding patch since it's not defined in test app)
        fc.constantFrom("get", "post", "put", "delete"),
        // Generate random user/session IDs
        fc.uuid(),
        async (method, id) => {
          // Map method to appropriate endpoint
          let endpoint: string;
          switch (method) {
            case "get":
              endpoint = `/api/body-map/${id}`;
              break;
            case "post":
              endpoint = `/api/pain-sessions`;
              break;
            case "put":
              endpoint = `/api/pain-sessions/${id}`;
              break;
            case "delete":
              endpoint = `/api/body-map/${id}`;
              break;
            default:
              endpoint = `/api/body-map/${id}`;
          }

          const response = await (request(app) as any)[method](endpoint);

          // Verify 401 status
          expect(response.status).toBe(401);
          
          // Verify response contains only error field, no data
          expect(response.body).toEqual({ error: "Unauthorized" });
          expect(Object.keys(response.body)).toEqual(["error"]);
        }
      ),
      { numRuns: 20 }
    );
  });
});
