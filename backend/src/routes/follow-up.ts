import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AuditLogger } from "../services/audit-logger.js";
import * as FollowUpEngine from "../services/follow-up-engine.js";
import * as BodyMapService from "../services/body-map-service.js";
import type { SymptomDescriptor } from "@bodytrace/shared";

const router = Router();

/**
 * Follow-Up Routes
 * 
 * Handles follow-up question generation:
 * - POST /api/follow-up/questions - Generate follow-up questions for a descriptor
 * - GET /api/follow-up/default-questions - Get default fallback questions
 * 
 * Validates: Requirements 4.1, 4.5
 */

export function createFollowUpRouter(auditLogger: AuditLogger): Router {
  /**
   * Generate follow-up questions for a symptom descriptor
   * POST /api/follow-up/questions
   */
  router.post("/questions", requireAuth, async (req: Request, res: Response) => {
    try {
      const { descriptor, userId } = req.body as {
        descriptor: SymptomDescriptor;
        userId?: string;
      };

      if (!descriptor || !descriptor.painType || !descriptor.markerId) {
        res.status(400).json({
          error: "Invalid descriptor data",
          message: "Descriptor must have painType and markerId",
        });
        return;
      }

      // Optionally load body map history for context-aware questions
      let bodyMap;
      if (userId) {
        try {
          bodyMap = await BodyMapService.getBodyMap(userId);
        } catch (error) {
          // If body map retrieval fails, continue without history
          console.warn("Could not load body map for follow-up questions:", error);
        }
      }

      // Generate questions
      const questions = FollowUpEngine.generateQuestions(descriptor, bodyMap);

      if (userId) {
        auditLogger.logAccess({
          userId,
          action: "generate_followup_questions",
          resourceType: "follow_up_question",
          resourceId: descriptor.id,
          timestamp: new Date(),
        });
      }

      res.json({ questions, count: questions.length });
    } catch (error) {
      console.error("Error generating follow-up questions:", error);
      res.status(500).json({
        error: "Failed to generate follow-up questions",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Get default fallback questions
   * GET /api/follow-up/default-questions
   */
  router.get("/default-questions", requireAuth, (_req: Request, res: Response) => {
    try {
      const questions = FollowUpEngine.getDefaultQuestions();
      res.json({ questions, count: questions.length });
    } catch (error) {
      console.error("Error getting default questions:", error);
      res.status(500).json({
        error: "Failed to get default questions",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
