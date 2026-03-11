import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { requireAuth, AuthenticatedRequest } from "../auth.js";

describe("Authentication Middleware", () => {
  const createMockRequest = (authHeader?: string): AuthenticatedRequest => {
    return {
      headers: authHeader ? { authorization: authHeader } : {},
    } as AuthenticatedRequest;
  };

  const createMockResponse = () => {
    const res = {} as Response;
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  const createMockNext = (): NextFunction => {
    return vi.fn() as NextFunction;
  };

  describe("requireAuth", () => {
    it("should return 401 when no Authorization header is present", () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when Authorization header is malformed", () => {
      const req = createMockRequest("InvalidFormat");
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when Bearer token is empty", () => {
      const req = createMockRequest("Bearer ");
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when token format is invalid", () => {
      const req = createMockRequest("Bearer invalid-token");
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next() when valid token is provided", () => {
      const req = createMockRequest("Bearer user-123e4567-e89b-12d3-a456-426614174000");
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(req.userId).toBe("user-123e4567-e89b-12d3-a456-426614174000");
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("should extract userId and attach to request", () => {
      const userId = "user-abc123";
      const req = createMockRequest(`Bearer ${userId}`);
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(req.userId).toBe(userId);
      expect(next).toHaveBeenCalled();
    });

    it("should not include data in 401 response", () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      // Verify no additional data is leaked
      const jsonCall = (res.json as any).mock.calls[0][0];
      expect(Object.keys(jsonCall)).toEqual(["error"]);
    });
  });

  describe("Edge cases", () => {
    it("should handle Authorization header with extra spaces", () => {
      const req = createMockRequest("Bearer  user-123");
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      // Should fail because of malformed format (extra space)
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle lowercase bearer", () => {
      const req = createMockRequest("bearer user-123");
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      // Should fail because Bearer must be capitalized
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should handle missing token after Bearer", () => {
      const req = createMockRequest("Bearer");
      const res = createMockResponse();
      const next = createMockNext();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
