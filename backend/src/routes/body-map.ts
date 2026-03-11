import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AuditLogger } from "../services/audit-logger.js";
import * as BodyMapService from "../services/body-map-service.js";
import type { MarkerFilter, AnatomicalRegion } from "@bodytrace/shared";

const router = Router();

/**
 * Body Map Routes
 * 
 * Handles body map retrieval and filtering:
 * - GET /api/body-map/:userId - Retrieve complete body map for a user
 * - POST /api/body-map/:userId/filter - Filter markers by criteria
 * - GET /api/body-map/:userId/region/:regionId - Get markers for a specific region
 * 
 * Validates: Requirements 5.1, 5.5
 */

export function createBodyMapRouter(auditLogger: AuditLogger): Router {
  /**
   * Get complete body map for a user
   * GET /api/body-map/:userId
   */
  router.get("/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const bodyMap = await BodyMapService.getBodyMap(userId);

      auditLogger.logAccess({
        userId,
        action: "read_body_map",
        resourceType: "body_map",
        resourceId: userId,
        timestamp: new Date(),
      });

      res.json(bodyMap);
    } catch (error) {
      console.error("Error retrieving body map:", error);
      res.status(500).json({
        error: "Failed to retrieve body map",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Filter markers by criteria
   * POST /api/body-map/:userId/filter
   */
  router.post("/:userId/filter", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const filters: MarkerFilter = req.body;

      // Convert date strings to Date objects if present
      if (filters.dateRange) {
        filters.dateRange = {
          start: new Date(filters.dateRange.start),
          end: new Date(filters.dateRange.end),
        };
      }

      const markers = await BodyMapService.filterMarkers(userId, filters);

      auditLogger.logAccess({
        userId,
        action: "filter_markers",
        resourceType: "body_map",
        resourceId: userId,
        timestamp: new Date(),
      });

      res.json({ markers, count: markers.length });
    } catch (error) {
      console.error("Error filtering markers:", error);
      res.status(500).json({
        error: "Failed to filter markers",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Get markers for a specific anatomical region
   * GET /api/body-map/:userId/region/:regionId
   */
  router.get("/:userId/region/:regionId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, regionId } = req.params;
      const { regionName } = req.query;

      // Construct the anatomical region object
      const region: AnatomicalRegion = {
        id: regionId,
        name: (regionName as string) || regionId,
        bodySystem: "musculoskeletal", // Default
      };

      const markers = await BodyMapService.getMarkersByRegion(userId, region);

      auditLogger.logAccess({
        userId,
        action: "read_region_markers",
        resourceType: "body_map",
        resourceId: `${userId}:${regionId}`,
        timestamp: new Date(),
      });

      res.json({ region, markers, count: markers.length });
    } catch (error) {
      console.error("Error retrieving region markers:", error);
      res.status(500).json({
        error: "Failed to retrieve region markers",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
