import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AuditLogger } from "../services/audit-logger.js";
import * as PainSessionManager from "../services/pain-session-manager.js";
import type { PainMarker, SymptomDescriptor } from "@bodytrace/shared";

const router = Router();

/**
 * Pain Session Routes
 * 
 * Handles CRUD operations for pain sessions:
 * - POST /api/pain-sessions - Create a new session
 * - GET /api/pain-sessions/:sessionId - Retrieve a session
 * - PUT /api/pain-sessions/:sessionId - Update/save a session
 * - POST /api/pain-sessions/:sessionId/markers - Add a marker to a session
 * - POST /api/pain-sessions/:sessionId/descriptors - Add a descriptor to a session
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

export function createPainSessionRouter(auditLogger: AuditLogger): Router {
  /**
   * Create a new pain session
   * POST /api/pain-sessions
   */
  router.post("/", requireAuth, (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({ error: "userId is required" });
        return;
      }

      const session = PainSessionManager.createSession(userId);

      auditLogger.logAccess({
        userId,
        action: "create_session",
        resourceType: "pain_session",
        resourceId: session.id,
        timestamp: new Date(),
      });

      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(500).json({
        error: "Failed to create session",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Get a pain session by ID
   * GET /api/pain-sessions/:sessionId
   */
  router.get("/:sessionId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const session = await PainSessionManager.resumeSession(sessionId);

      auditLogger.logAccess({
        userId: session.userId,
        action: "read_session",
        resourceType: "pain_session",
        resourceId: sessionId,
        timestamp: new Date(),
      });

      res.json(session);
    } catch (error) {
      console.error("Error retrieving session:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: "Session not found" });
      } else {
        res.status(500).json({
          error: "Failed to retrieve session",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  });

  /**
   * Save/update a pain session
   * PUT /api/pain-sessions/:sessionId
   */
  router.put("/:sessionId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      await PainSessionManager.saveSession(sessionId);

      // Get the session to log the userId
      const session = PainSessionManager.getActiveSession(sessionId);
      if (session) {
        auditLogger.logAccess({
          userId: session.userId,
          action: "update_session",
          resourceType: "pain_session",
          resourceId: sessionId,
          timestamp: new Date(),
        });
      }

      res.json({ message: "Session saved successfully", sessionId });
    } catch (error) {
      console.error("Error saving session:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: "Session not found" });
      } else {
        res.status(500).json({
          error: "Failed to save session",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  });

  /**
   * Add a pain marker to a session
   * POST /api/pain-sessions/:sessionId/markers
   */
  router.post("/:sessionId/markers", requireAuth, (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const marker: PainMarker = req.body;

      if (!marker.id || !marker.location || marker.intensity === undefined) {
        res.status(400).json({
          error: "Invalid marker data",
          message: "Marker must have id, location, and intensity",
        });
        return;
      }

      PainSessionManager.addMarker(sessionId, marker);

      const session = PainSessionManager.getActiveSession(sessionId);
      if (session) {
        auditLogger.logAccess({
          userId: session.userId,
          action: "add_marker",
          resourceType: "pain_marker",
          resourceId: marker.id,
          timestamp: new Date(),
        });
      }

      res.status(201).json({ message: "Marker added successfully", marker });
    } catch (error) {
      console.error("Error adding marker:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: "Session not found" });
      } else {
        res.status(500).json({
          error: "Failed to add marker",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  });

  /**
   * Add a symptom descriptor to a session
   * POST /api/pain-sessions/:sessionId/descriptors
   */
  router.post("/:sessionId/descriptors", requireAuth, (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const descriptor: SymptomDescriptor = req.body;

      if (!descriptor.id || !descriptor.markerId || !descriptor.painType) {
        res.status(400).json({
          error: "Invalid descriptor data",
          message: "Descriptor must have id, markerId, and painType",
        });
        return;
      }

      PainSessionManager.addDescriptor(sessionId, descriptor);

      const session = PainSessionManager.getActiveSession(sessionId);
      if (session) {
        auditLogger.logAccess({
          userId: session.userId,
          action: "add_descriptor",
          resourceType: "symptom_descriptor",
          resourceId: descriptor.id,
          timestamp: new Date(),
        });
      }

      res.status(201).json({ message: "Descriptor added successfully", descriptor });
    } catch (error) {
      console.error("Error adding descriptor:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        res.status(404).json({ error: "Session not found" });
      } else {
        res.status(500).json({
          error: "Failed to add descriptor",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  });

  return router;
}
