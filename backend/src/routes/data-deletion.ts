import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { AuditLogger } from "../services/audit-logger.js";
import { DataDeletionService } from "../services/data-deletion-service.js";

const router = Router();

/**
 * Data Deletion Routes
 * 
 * Handles user data deletion requests:
 * - DELETE /api/users/:userId/data - Delete all user data
 * - GET /api/users/:userId/data/verify-deletion - Verify deletion completion
 * 
 * Validates: Requirements 9.4
 */

export function createDataDeletionRouter(auditLogger: AuditLogger): Router {
  const dataDeletionService = new DataDeletionService(auditLogger);

  /**
   * Delete all user data
   * DELETE /api/users/:userId/data
   */
  router.delete("/:userId/data", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // In production, verify that the authenticated user matches the userId
      // or has admin privileges to delete other users' data

      const result = await dataDeletionService.deleteUserData(userId);

      res.json({
        message: "User data deletion completed successfully",
        result,
      });
    } catch (error) {
      console.error("Data deletion error:", error);
      res.status(500).json({
        error: "Failed to delete user data",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  /**
   * Verify data deletion completion
   * GET /api/users/:userId/data/verify-deletion
   */
  router.get("/:userId/data/verify-deletion", requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const isDeleted = await dataDeletionService.verifyDeletion(userId);

      res.json({
        userId,
        isDeleted,
        message: isDeleted
          ? "All user data has been successfully deleted"
          : "User data still exists in the system",
      });
    } catch (error) {
      console.error("Verification error:", error);
      res.status(500).json({
        error: "Failed to verify data deletion",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  return router;
}
