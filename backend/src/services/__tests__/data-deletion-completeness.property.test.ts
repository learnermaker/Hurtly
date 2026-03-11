// Feature: body-trace, Property 22: Data deletion completeness
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import { DataDeletionService } from "../data-deletion-service.js";
import { AuditLogger } from "../audit-logger.js";
import pool from "../../db/index.js";
import type {
  PainType,
  PainFrequency,
  PainDuration,
} from "@bodytrace/shared";

/**
 * **Validates: Requirements 9.4**
 *
 * Property 22: Data deletion completeness
 * For any user who requests data deletion, after the deletion is processed,
 * querying for that user's Pain Sessions, Pain Markers, Symptom Descriptors,
 * and Body Map data should return empty results.
 */

// --- Arbitraries ---

const painTypeArb: fc.Arbitrary<PainType> = fc.constantFrom(
  "sharp", "dull", "burning", "throbbing",
  "aching", "stabbing", "tingling", "numbness"
);

const frequencyArb: fc.Arbitrary<PainFrequency> = fc.constantFrom(
  "constant", "intermittent", "occasional", "only-during-activity"
);

const durationArb: fc.Arbitrary<PainDuration> = fc.constantFrom(
  "seconds", "minutes", "hours", "days", "weeks"
);

const intensityArb = fc.integer({ min: 0, max: 10 });

const statusArb = fc.constantFrom("active", "resolved", "historical");

const sessionStatusArb = fc.constantFrom("in-progress", "completed");

const coordinatesArb = fc.record({
  x: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  y: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
  z: fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
});

const regionIdArb = fc.constantFrom(
  "left-shoulder", "right-shoulder", "lower-back", "upper-back",
  "left-knee", "right-knee", "chest", "abdomen", "neck", "head"
);

const regionNameArb = fc.constantFrom(
  "Left Shoulder", "Right Shoulder", "Lower Back", "Upper Back",
  "Left Knee", "Right Knee", "Chest", "Abdomen", "Neck", "Head"
);

// Generate a marker with descriptor and optional follow-up responses
const markerWithDescriptorArb = fc.record({
  regionId: regionIdArb,
  regionName: regionNameArb,
  coordinates: coordinatesArb,
  intensity: intensityArb,
  status: statusArb,
  painType: painTypeArb,
  frequency: frequencyArb,
  duration: durationArb,
  followUpCount: fc.integer({ min: 0, max: 3 }),
});

// Generate a session with 1-5 markers
const sessionArb = fc.record({
  status: sessionStatusArb,
  markers: fc.array(markerWithDescriptorArb, { minLength: 1, maxLength: 5 }),
});

// Generate user data with 1-3 sessions
const userDataArb = fc.record({
  sessionCount: fc.integer({ min: 1, max: 3 }),
  sessions: fc.array(sessionArb, { minLength: 1, maxLength: 3 }),
  hasBodyMap: fc.boolean(),
  hasInsightReport: fc.boolean(),
});

// --- Test ---

describe("Property 22: Data deletion completeness", () => {
  let service: DataDeletionService;
  let auditLogger: AuditLogger;
  const testUserIds: string[] = [];

  beforeEach(() => {
    auditLogger = new AuditLogger();
    service = new DataDeletionService(auditLogger);
  });

  afterEach(async () => {
    // Clean up any test users that weren't deleted
    for (const userId of testUserIds) {
      try {
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
      } catch {
        // User may already be deleted
      }
    }
    testUserIds.length = 0;
    auditLogger.clearLogs();
  });

  it("should return empty results for all user data queries after deletion", { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(userDataArb, async (userData) => {
        // Create a test user
        const userResult = await pool.query(
          "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
          [`test-${Date.now()}-${Math.random()}@example.com`, "hash"]
        );
        const userId = userResult.rows[0].id;
        testUserIds.push(userId);

        // Create sessions with markers and descriptors
        const sessionIds: string[] = [];
        const markerIds: string[] = [];
        const descriptorIds: string[] = [];

        for (const session of userData.sessions) {
          // Create session
          const sessionResult = await pool.query(
            "INSERT INTO pain_sessions (user_id, status) VALUES ($1, $2) RETURNING id",
            [userId, session.status]
          );
          const sessionId = sessionResult.rows[0].id;
          sessionIds.push(sessionId);

          // Create markers for this session
          for (const marker of session.markers) {
            const markerResult = await pool.query(
              `INSERT INTO pain_markers (session_id, region_id, region_name, coordinates, intensity, status)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [
                sessionId,
                marker.regionId,
                marker.regionName,
                JSON.stringify(marker.coordinates),
                marker.intensity,
                marker.status,
              ]
            );
            const markerId = markerResult.rows[0].id;
            markerIds.push(markerId);

            // Create descriptor for this marker
            const descriptorResult = await pool.query(
              `INSERT INTO symptom_descriptors (marker_id, pain_type, intensity, frequency, duration)
               VALUES ($1, $2, $3, $4, $5) RETURNING id`,
              [markerId, marker.painType, marker.intensity, marker.frequency, marker.duration]
            );
            const descriptorId = descriptorResult.rows[0].id;
            descriptorIds.push(descriptorId);

            // Create follow-up responses
            for (let i = 0; i < marker.followUpCount; i++) {
              await pool.query(
                `INSERT INTO follow_up_responses (descriptor_id, question_id, question_text, response)
                 VALUES ($1, $2, $3, $4)`,
                [
                  descriptorId,
                  `q-${i}`,
                  `Question ${i}?`,
                  `Response ${i}`,
                ]
              );
            }

            // Create symptom signal for this marker
            await pool.query(
              `INSERT INTO symptom_signals (marker_id, anatomical_region, pain_type, intensity, frequency, duration, raw_json)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                markerId,
                marker.regionName,
                marker.painType,
                marker.intensity,
                marker.frequency,
                marker.duration,
                JSON.stringify({
                  id: `signal-${markerId}`,
                  markerId,
                  anatomicalRegion: marker.regionName,
                  painType: marker.painType,
                  intensity: marker.intensity,
                  frequency: marker.frequency,
                  duration: marker.duration,
                  timestamp: new Date().toISOString(),
                }),
              ]
            );
          }
        }

        // Create body map if specified
        if (userData.hasBodyMap) {
          await pool.query(
            "INSERT INTO body_maps (user_id) VALUES ($1)",
            [userId]
          );
        }

        // Create insight report if specified
        if (userData.hasInsightReport) {
          await pool.query(
            `INSERT INTO insight_reports (user_id, patterns, frequency_trends, intensity_changes)
             VALUES ($1, $2, $3, $4)`,
            [userId, JSON.stringify([]), JSON.stringify([]), JSON.stringify([])]
          );
        }

        // Verify data exists before deletion
        const preSessionCheck = await pool.query(
          "SELECT COUNT(*) FROM pain_sessions WHERE user_id = $1",
          [userId]
        );
        const preSessionCount = parseInt(preSessionCheck.rows[0].count, 10);
        expect(preSessionCount).toBeGreaterThan(0);

        // Delete user data
        const result = await service.deleteUserData(userId);
        expect(result.success).toBe(true);

        // Verify all queries return empty results

        // 1. Pain Sessions should be empty
        const sessionCheck = await pool.query(
          "SELECT COUNT(*) FROM pain_sessions WHERE user_id = $1",
          [userId]
        );
        expect(parseInt(sessionCheck.rows[0].count, 10)).toBe(0);

        // 2. Pain Markers should be empty (cascade delete)
        const markerCheck = await pool.query(
          `SELECT COUNT(*) FROM pain_markers pm
           JOIN pain_sessions ps ON pm.session_id = ps.id
           WHERE ps.user_id = $1`,
          [userId]
        );
        expect(parseInt(markerCheck.rows[0].count, 10)).toBe(0);

        // 3. Symptom Descriptors should be empty (cascade delete)
        const descriptorCheck = await pool.query(
          `SELECT COUNT(*) FROM symptom_descriptors sd
           JOIN pain_markers pm ON sd.marker_id = pm.id
           JOIN pain_sessions ps ON pm.session_id = ps.id
           WHERE ps.user_id = $1`,
          [userId]
        );
        expect(parseInt(descriptorCheck.rows[0].count, 10)).toBe(0);

        // 4. Follow-up Responses should be empty (cascade delete)
        const responseCheck = await pool.query(
          `SELECT COUNT(*) FROM follow_up_responses fr
           JOIN symptom_descriptors sd ON fr.descriptor_id = sd.id
           JOIN pain_markers pm ON sd.marker_id = pm.id
           JOIN pain_sessions ps ON pm.session_id = ps.id
           WHERE ps.user_id = $1`,
          [userId]
        );
        expect(parseInt(responseCheck.rows[0].count, 10)).toBe(0);

        // 5. Symptom Signals should be empty (cascade delete)
        const signalCheck = await pool.query(
          `SELECT COUNT(*) FROM symptom_signals ss
           JOIN pain_markers pm ON ss.marker_id = pm.id
           JOIN pain_sessions ps ON pm.session_id = ps.id
           WHERE ps.user_id = $1`,
          [userId]
        );
        expect(parseInt(signalCheck.rows[0].count, 10)).toBe(0);

        // 6. Body Map should be empty
        const bodyMapCheck = await pool.query(
          "SELECT COUNT(*) FROM body_maps WHERE user_id = $1",
          [userId]
        );
        expect(parseInt(bodyMapCheck.rows[0].count, 10)).toBe(0);

        // 7. Insight Reports should be empty
        const reportCheck = await pool.query(
          "SELECT COUNT(*) FROM insight_reports WHERE user_id = $1",
          [userId]
        );
        expect(parseInt(reportCheck.rows[0].count, 10)).toBe(0);

        // 8. Verify using the service's verifyDeletion method
        const isDeleted = await service.verifyDeletion(userId);
        expect(isDeleted).toBe(true);

        // Clean up test user
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
        const userIndex = testUserIds.indexOf(userId);
        if (userIndex > -1) {
          testUserIds.splice(userIndex, 1);
        }
      }),
      { numRuns: 20 }
    );
  });
});
