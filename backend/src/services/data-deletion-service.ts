/**
 * Data Deletion Service
 * 
 * Handles permanent deletion of all user data including Pain Sessions,
 * Pain Markers, Symptom Descriptors, and Body Map data.
 * 
 * Validates: Requirements 9.4
 */

import pool from "../db/index.js";
import { AuditLogger } from "./audit-logger.js";

export interface DeletionResult {
  userId: string;
  deletedAt: Date;
  sessionsDeleted: number;
  markersDeleted: number;
  descriptorsDeleted: number;
  success: boolean;
}

export class DataDeletionService {
  private auditLogger: AuditLogger;

  constructor(auditLogger: AuditLogger) {
    this.auditLogger = auditLogger;
  }

  /**
   * Permanently delete all user data
   * 
   * Deletes all Pain Sessions, Pain Markers, Symptom Descriptors,
   * Follow-up Responses, Symptom Signals, Body Maps, and Insight Reports
   * for the specified user.
   * 
   * @param userId - The user ID whose data should be deleted
   * @returns DeletionResult with counts of deleted records
   */
  async deleteUserData(userId: string): Promise<DeletionResult> {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Log the deletion request (before deletion)
      this.auditLogger.logAccess({
        userId,
        action: "data_deletion_requested",
        resourceType: "user_data",
        resourceId: userId,
        timestamp: new Date(),
      });

      // Count records before deletion for the result
      const sessionCountResult = await client.query(
        "SELECT COUNT(*) FROM pain_sessions WHERE user_id = $1",
        [userId]
      );
      const sessionsDeleted = parseInt(sessionCountResult.rows[0].count, 10);

      const markerCountResult = await client.query(
        `SELECT COUNT(*) FROM pain_markers pm
         JOIN pain_sessions ps ON pm.session_id = ps.id
         WHERE ps.user_id = $1`,
        [userId]
      );
      const markersDeleted = parseInt(markerCountResult.rows[0].count, 10);

      const descriptorCountResult = await client.query(
        `SELECT COUNT(*) FROM symptom_descriptors sd
         JOIN pain_markers pm ON sd.marker_id = pm.id
         JOIN pain_sessions ps ON pm.session_id = ps.id
         WHERE ps.user_id = $1`,
        [userId]
      );
      const descriptorsDeleted = parseInt(descriptorCountResult.rows[0].count, 10);

      // Delete insight reports
      await client.query(
        "DELETE FROM insight_reports WHERE user_id = $1",
        [userId]
      );

      // Delete body maps
      await client.query(
        "DELETE FROM body_maps WHERE user_id = $1",
        [userId]
      );

      // Delete pain sessions (cascades to markers, descriptors, responses, signals)
      await client.query(
        "DELETE FROM pain_sessions WHERE user_id = $1",
        [userId]
      );

      await client.query("COMMIT");

      // Log successful deletion
      this.auditLogger.logAccess({
        userId,
        action: "data_deletion_completed",
        resourceType: "user_data",
        resourceId: userId,
        timestamp: new Date(),
      });

      return {
        userId,
        deletedAt: new Date(),
        sessionsDeleted,
        markersDeleted,
        descriptorsDeleted,
        success: true,
      };
    } catch (error) {
      await client.query("ROLLBACK");

      // Log failed deletion attempt
      this.auditLogger.logAccess({
        userId,
        action: "data_deletion_failed",
        resourceType: "user_data",
        resourceId: userId,
        timestamp: new Date(),
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify that all user data has been deleted
   * 
   * @param userId - The user ID to verify
   * @returns true if no data exists for the user, false otherwise
   */
  async verifyDeletion(userId: string): Promise<boolean> {
    const client = await pool.connect();

    try {
      // Check for any remaining pain sessions
      const sessionResult = await client.query(
        "SELECT COUNT(*) FROM pain_sessions WHERE user_id = $1",
        [userId]
      );

      // Check for any remaining body maps
      const bodyMapResult = await client.query(
        "SELECT COUNT(*) FROM body_maps WHERE user_id = $1",
        [userId]
      );

      // Check for any remaining insight reports
      const reportResult = await client.query(
        "SELECT COUNT(*) FROM insight_reports WHERE user_id = $1",
        [userId]
      );

      const sessionCount = parseInt(sessionResult.rows[0].count, 10);
      const bodyMapCount = parseInt(bodyMapResult.rows[0].count, 10);
      const reportCount = parseInt(reportResult.rows[0].count, 10);

      return sessionCount === 0 && bodyMapCount === 0 && reportCount === 0;
    } finally {
      client.release();
    }
  }
}
