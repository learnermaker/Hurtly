import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AuditLogger } from "../services/audit-logger.js";
import defaultPool from "../db/index.js";
import type { FollowUpResponse } from "@bodytrace/shared";

const router = Router();

/**
 * Symptom Descriptor Routes
 * 
 * Handles symptom descriptor retrieval:
 * - GET /api/symptom-descriptors/:descriptorId - Retrieve a specific descriptor
 * 
 * Note: Creating descriptors is done through the pain-sessions routes
 */

export function createSymptomDescriptorRouter(auditLogger: AuditLogger): Router {
  /**
   * Get a specific symptom descriptor by ID
   * GET /api/symptom-descriptors/:descriptorId
   */
  router.get("/:descriptorId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { descriptorId } = req.params;

      const client = await defaultPool.connect();
      try {
        // Get the descriptor
        const descResult = await client.query(
          `SELECT sd.id, sd.marker_id, sd.pain_type, sd.intensity,
                  sd.frequency, sd.duration, sd.completed_at,
                  ps.user_id
           FROM symptom_descriptors sd
           JOIN pain_markers pm ON pm.id = sd.marker_id
           JOIN pain_sessions ps ON ps.id = pm.session_id
           WHERE sd.id = $1`,
          [descriptorId]
        );

        if (descResult.rows.length === 0) {
          res.status(404).json({ error: "Symptom descriptor not found" });
          return;
        }

        const row = descResult.rows[0];

        // Get follow-up responses
        const respResult = await client.query(
          `SELECT question_id, question_text, response, answered_at
           FROM follow_up_responses
           WHERE descriptor_id = $1
           ORDER BY answered_at`,
          [descriptorId]
        );

        const followUpResponses: FollowUpResponse[] = respResult.rows.map((r: any) => ({
          questionId: r.question_id,
          questionText: r.question_text,
          response: r.response,
          answeredAt: new Date(r.answered_at),
        }));

        const descriptor = {
          id: row.id,
          markerId: row.marker_id,
          painType: row.pain_type,
          intensity: row.intensity,
          frequency: row.frequency,
          duration: row.duration,
          followUpResponses,
          completedAt: new Date(row.completed_at),
        };

        auditLogger.logAccess({
          userId: row.user_id,
          action: "read_descriptor",
          resourceType: "symptom_descriptor",
          resourceId: descriptorId,
          timestamp: new Date(),
        });

        res.json(descriptor);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error retrieving symptom descriptor:", error);
      res.status(500).json({
        error: "Failed to retrieve symptom descriptor",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
