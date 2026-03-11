import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AuditLogger } from "../services/audit-logger.js";
import { InsightReportGenerator } from "../services/insight-report-generator.js";
import * as BodyMapService from "../services/body-map-service.js";

const router = Router();

/**
 * Insight Report Routes
 * 
 * Handles insight report generation and export:
 * - POST /api/insight-reports/:userId - Generate an insight report
 * - POST /api/insight-reports/:userId/export - Generate and export report as PDF
 * 
 * Validates: Requirements 7.1, 7.4
 */

export function createInsightReportRouter(auditLogger: AuditLogger): Router {
  const reportGenerator = new InsightReportGenerator();

  /**
   * Generate an insight report for a user
   * POST /api/insight-reports/:userId
   */
  router.post("/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // Get the user's body map data
      const bodyMap = await BodyMapService.getBodyMap(userId);

      // Generate the insight report
      const report = reportGenerator.generate(bodyMap);

      auditLogger.logAccess({
        userId,
        action: "generate_report",
        resourceType: "insight_report",
        resourceId: report.id,
        timestamp: new Date(),
      });

      res.json(report);
    } catch (error) {
      console.error("Error generating insight report:", error);
      res.status(500).json({
        error: "Failed to generate insight report",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Generate and export an insight report as PDF
   * POST /api/insight-reports/:userId/export
   */
  router.post("/:userId/export", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // Get the user's body map data
      const bodyMap = await BodyMapService.getBodyMap(userId);

      // Generate the insight report
      const report = reportGenerator.generate(bodyMap);

      // Export to PDF
      const pdfBuffer = await reportGenerator.exportPDF(report);

      auditLogger.logAccess({
        userId,
        action: "export_report_pdf",
        resourceType: "insight_report",
        resourceId: report.id,
        timestamp: new Date(),
      });

      // Set headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="bodytrace-report-${report.id}.pdf"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error exporting insight report:", error);
      res.status(500).json({
        error: "Failed to export insight report",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
