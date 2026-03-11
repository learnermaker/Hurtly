import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AuditLogger } from "../services/audit-logger.js";
import { SymptomTimelineServiceImpl } from "../services/symptom-timeline-service.js";
import defaultPool from "../db/index.js";
import type { AnatomicalRegion } from "@bodytrace/shared";

const router = Router();

/**
 * Timeline Routes
 * 
 * Handles symptom timeline data retrieval:
 * - GET /api/timeline/:userId/region/:regionId - Get timeline for a specific region
 * 
 * Validates: Requirements 6.1
 */

export function createTimelineRouter(auditLogger: AuditLogger): Router {
  const timelineService = new SymptomTimelineServiceImpl(defaultPool);

  /**
   * Get timeline data for a specific anatomical region
   * GET /api/timeline/:userId/region/:regionId
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

      const timelineData = await timelineService.getTimeline(userId, region);

      // Compute trend if data spans more than 7 days
      let trend = null;
      if (timelineData.entries.length > 0) {
        const firstDate = timelineData.entries[0].date;
        const lastDate = timelineData.entries[timelineData.entries.length - 1].date;
        const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff > 7) {
          trend = timelineService.computeTrend(timelineData);
        }
      }

      auditLogger.logAccess({
        userId,
        action: "read_timeline",
        resourceType: "timeline",
        resourceId: `${userId}:${regionId}`,
        timestamp: new Date(),
      });

      res.json({
        ...timelineData,
        trend,
        entryCount: timelineData.entries.length,
      });
    } catch (error) {
      console.error("Error retrieving timeline:", error);
      res.status(500).json({
        error: "Failed to retrieve timeline",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
