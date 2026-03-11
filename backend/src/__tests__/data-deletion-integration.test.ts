/**
 * Integration tests for Data Deletion Service
 * 
 * These tests require a running PostgreSQL database.
 * Run with: npm test -- data-deletion-integration.test.ts
 * 
 * Tests the permanent deletion of user data including Pain Sessions,
 * Pain Markers, Symptom Descriptors, and Body Map data.
 * 
 * Validates: Requirements 9.4
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DataDeletionService } from "../services/data-deletion-service.js";
import { AuditLogger } from "../services/audit-logger.js";
import pool from "../db/index.js";

describe("DataDeletionService Integration Tests", () => {
  let service: DataDeletionService;
  let auditLogger: AuditLogger;
  let testUserId: string;

  beforeEach(async () => {
    auditLogger = new AuditLogger();
    service = new DataDeletionService(auditLogger);

    // Create a test user
    const userResult = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
      [`test-${Date.now()}@example.com`, "hash"]
    );
    testUserId = userResult.rows[0].id;
  });

  afterEach(async () => {
    // Clean up test data
    await pool.query("DELETE FROM users WHERE id = $1", [testUserId]);
    auditLogger.clearLogs();
  });

  it("should delete all user data successfully", async () => {
    // Create test data
    const sessionResult = await pool.query(
      "INSERT INTO pain_sessions (user_id, status) VALUES ($1, $2) RETURNING id",
      [testUserId, "completed"]
    );
    const sessionId = sessionResult.rows[0].id;

    const markerResult = await pool.query(
      `INSERT INTO pain_markers (session_id, region_id, region_name, coordinates, intensity)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [sessionId, "left-shoulder", "Left Shoulder", JSON.stringify({ x: 0, y: 0, z: 0 }), 7]
    );
    const markerId = markerResult.rows[0].id;

    await pool.query(
      `INSERT INTO symptom_descriptors (marker_id, pain_type, intensity, frequency, duration)
       VALUES ($1, $2, $3, $4, $5)`,
      [markerId, "sharp", 7, "intermittent", "hours"]
    );

    await pool.query(
      "INSERT INTO body_maps (user_id) VALUES ($1)",
      [testUserId]
    );

    // Delete user data
    const result = await service.deleteUserData(testUserId);

    // Verify result
    expect(result.success).toBe(true);
    expect(result.userId).toBe(testUserId);
    expect(result.sessionsDeleted).toBe(1);
    expect(result.markersDeleted).toBe(1);
    expect(result.descriptorsDeleted).toBe(1);
    expect(result.deletedAt).toBeInstanceOf(Date);

    // Verify data is actually deleted
    const sessionCheck = await pool.query(
      "SELECT COUNT(*) FROM pain_sessions WHERE user_id = $1",
      [testUserId]
    );
    expect(parseInt(sessionCheck.rows[0].count, 10)).toBe(0);

    const bodyMapCheck = await pool.query(
      "SELECT COUNT(*) FROM body_maps WHERE user_id = $1",
      [testUserId]
    );
    expect(parseInt(bodyMapCheck.rows[0].count, 10)).toBe(0);
  });

  it("should log audit events for data deletion", async () => {
    // Create minimal test data
    await pool.query(
      "INSERT INTO pain_sessions (user_id, status) VALUES ($1, $2)",
      [testUserId, "completed"]
    );

    // Delete user data
    await service.deleteUserData(testUserId);

    // Verify audit logs
    const logs = auditLogger.getLogsByUser(testUserId);
    expect(logs.length).toBeGreaterThanOrEqual(2);

    const requestLog = logs.find((log) => log.action === "data_deletion_requested");
    expect(requestLog).toBeDefined();
    expect(requestLog?.resourceType).toBe("user_data");

    const completedLog = logs.find((log) => log.action === "data_deletion_completed");
    expect(completedLog).toBeDefined();
    expect(completedLog?.resourceType).toBe("user_data");
  });

  it("should handle deletion of user with no data", async () => {
    // Delete user data when no sessions exist
    const result = await service.deleteUserData(testUserId);

    expect(result.success).toBe(true);
    expect(result.sessionsDeleted).toBe(0);
    expect(result.markersDeleted).toBe(0);
    expect(result.descriptorsDeleted).toBe(0);
  });

  it("should delete multiple sessions and markers", async () => {
    // Create multiple sessions
    const session1 = await pool.query(
      "INSERT INTO pain_sessions (user_id, status) VALUES ($1, $2) RETURNING id",
      [testUserId, "completed"]
    );
    const session2 = await pool.query(
      "INSERT INTO pain_sessions (user_id, status) VALUES ($1, $2) RETURNING id",
      [testUserId, "in-progress"]
    );

    // Create markers for each session
    await pool.query(
      `INSERT INTO pain_markers (session_id, region_id, region_name, coordinates, intensity)
       VALUES ($1, $2, $3, $4, $5)`,
      [session1.rows[0].id, "left-shoulder", "Left Shoulder", JSON.stringify({ x: 0, y: 0, z: 0 }), 7]
    );
    await pool.query(
      `INSERT INTO pain_markers (session_id, region_id, region_name, coordinates, intensity)
       VALUES ($1, $2, $3, $4, $5)`,
      [session2.rows[0].id, "lower-back", "Lower Back", JSON.stringify({ x: 0, y: 0, z: 0 }), 5]
    );

    // Delete user data
    const result = await service.deleteUserData(testUserId);

    expect(result.success).toBe(true);
    expect(result.sessionsDeleted).toBe(2);
    expect(result.markersDeleted).toBe(2);
  });

  it("should verify deletion correctly", async () => {
    // Create test data
    const sessionResult = await pool.query(
      "INSERT INTO pain_sessions (user_id, status) VALUES ($1, $2) RETURNING id",
      [testUserId, "completed"]
    );
    await pool.query(
      `INSERT INTO pain_markers (session_id, region_id, region_name, coordinates, intensity)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionResult.rows[0].id, "left-shoulder", "Left Shoulder", JSON.stringify({ x: 0, y: 0, z: 0 }), 7]
    );

    // Verify data exists before deletion
    let isDeleted = await service.verifyDeletion(testUserId);
    expect(isDeleted).toBe(false);

    // Delete data
    await service.deleteUserData(testUserId);

    // Verify data is deleted
    isDeleted = await service.verifyDeletion(testUserId);
    expect(isDeleted).toBe(true);
  });

  it("should delete insight reports", async () => {
    // Create insight report
    await pool.query(
      `INSERT INTO insight_reports (user_id, patterns, frequency_trends, intensity_changes)
       VALUES ($1, $2, $3, $4)`,
      [testUserId, JSON.stringify([]), JSON.stringify([]), JSON.stringify([])]
    );

    // Delete user data
    await service.deleteUserData(testUserId);

    // Verify insight reports are deleted
    const reportCheck = await pool.query(
      "SELECT COUNT(*) FROM insight_reports WHERE user_id = $1",
      [testUserId]
    );
    expect(parseInt(reportCheck.rows[0].count, 10)).toBe(0);
  });

  it("should cascade delete follow-up responses", async () => {
    // Create test data with follow-up responses
    const sessionResult = await pool.query(
      "INSERT INTO pain_sessions (user_id, status) VALUES ($1, $2) RETURNING id",
      [testUserId, "completed"]
    );
    const sessionId = sessionResult.rows[0].id;

    const markerResult = await pool.query(
      `INSERT INTO pain_markers (session_id, region_id, region_name, coordinates, intensity)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [sessionId, "left-shoulder", "Left Shoulder", JSON.stringify({ x: 0, y: 0, z: 0 }), 7]
    );
    const markerId = markerResult.rows[0].id;

    const descriptorResult = await pool.query(
      `INSERT INTO symptom_descriptors (marker_id, pain_type, intensity, frequency, duration)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [markerId, "sharp", 7, "intermittent", "hours"]
    );
    const descriptorId = descriptorResult.rows[0].id;

    await pool.query(
      `INSERT INTO follow_up_responses (descriptor_id, question_id, question_text, response)
       VALUES ($1, $2, $3, $4)`,
      [descriptorId, "q1", "How long have you had this pain?", "About 2 weeks"]
    );

    // Delete user data
    await service.deleteUserData(testUserId);

    // Verify follow-up responses are cascade deleted
    const responseCheck = await pool.query(
      "SELECT COUNT(*) FROM follow_up_responses WHERE descriptor_id = $1",
      [descriptorId]
    );
    expect(parseInt(responseCheck.rows[0].count, 10)).toBe(0);
  });
});
