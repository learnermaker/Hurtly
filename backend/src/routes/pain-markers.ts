import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AuditLogger } from "../services/audit-logger.js";
import defaultPool from "../db/index.js";

const router = Router();

/**
 * Pain Marker Routes
 * 
 * Handles pain marker retrieval:
 * - GET /api/pain-markers/:markerId - Retrieve a specific pain marker
 * 
 * Note: Creating markers is done through the pain-sessions routes
 */

export function createPainMarkerRouter(auditLogger: AuditLogger): Router {
  /**
   * Get a specific pain marker by ID
   * GET /api/pain-markers/:markerId
   */
  router.get("/:markerId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { markerId } = req.params;

      const client = await defaultPool.connect();
      try {
        const result = await client.query(
          `SELECT pm.id, pm.session_id, pm.region_id, pm.region_name,
                  pm.coordinates, pm.boundary, pm.intensity, pm.status, pm.created_at,
                  ps.user_id
           FROM pain_markers pm
           JOIN pain_sessions ps ON ps.id = pm.session_id
           WHERE pm.id = $1`,
          [markerId]
        );

        if (result.rows.length === 0) {
          res.status(404).json({ error: "Pain marker not found" });
          return;
        }

        const row = result.rows[0];
        const marker = {
          id: row.id,
          sessionId: row.session_id,
          location: {
            region: {
              id: row.region_id,
              name: row.region_name,
              bodySystem: "musculoskeletal",
            },
            coordinates:
              typeof row.coordinates === "string"
                ? JSON.parse(row.coordinates)
                : row.coordinates,
          },
          boundary: row.boundary
            ? typeof row.boundary === "string"
              ? JSON.parse(row.boundary)
              : row.boundary
            : undefined,
          intensity: row.intensity,
          createdAt: new Date(row.created_at),
          status: row.status,
        };

        auditLogger.logAccess({
          userId: row.user_id,
          action: "read_marker",
          resourceType: "pain_marker",
          resourceId: markerId,
          timestamp: new Date(),
        });

        res.json(marker);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Error retrieving pain marker:", error);
      res.status(500).json({
        error: "Failed to retrieve pain marker",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
