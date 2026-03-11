import { Router } from "express";
import { AuditLogger } from "../services/audit-logger.js";
import { createPainSessionRouter } from "./pain-sessions.js";
import { createBodyMapRouter } from "./body-map.js";
import { createTimelineRouter } from "./timeline.js";
import { createInsightReportRouter } from "./insight-reports.js";
import { createFollowUpRouter } from "./follow-up.js";
import { createPainMarkerRouter } from "./pain-markers.js";
import { createSymptomDescriptorRouter } from "./symptom-descriptors.js";
import { createDataDeletionRouter } from "./data-deletion.js";

/**
 * Main router aggregator
 * 
 * Combines all route modules and applies them to the Express app.
 * All routes require authentication and apply audit logging.
 * 
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 5.1, 5.5, 6.1, 7.1, 7.4, 9.3, 9.5
 */

export function createApiRouter(auditLogger: AuditLogger): Router {
  const router = Router();

  // Mount all route modules
  router.use("/pain-sessions", createPainSessionRouter(auditLogger));
  router.use("/body-map", createBodyMapRouter(auditLogger));
  router.use("/timeline", createTimelineRouter(auditLogger));
  router.use("/insight-reports", createInsightReportRouter(auditLogger));
  router.use("/follow-up", createFollowUpRouter(auditLogger));
  router.use("/pain-markers", createPainMarkerRouter(auditLogger));
  router.use("/symptom-descriptors", createSymptomDescriptorRouter(auditLogger));
  router.use("/users", createDataDeletionRouter(auditLogger));

  return router;
}
