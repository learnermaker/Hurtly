import { v4 as uuidv4 } from "uuid";
import type { Pool, PoolClient } from "pg";
import type {
  PainSession,
  PainMarker,
  SymptomDescriptor,
  FollowUpResponse,
} from "@bodytrace/shared";
import defaultPool from "../db/index.js";

/** In-memory store for active (not yet persisted) sessions. */
const activeSessions = new Map<string, PainSession>();

/**
 * Create a new Pain Session with a unique ID and timestamp.
 */
export function createSession(userId: string): PainSession {
  const now = new Date();
  const session: PainSession = {
    id: uuidv4(),
    userId,
    markers: [],
    descriptors: [],
    status: "in-progress",
    createdAt: now,
    updatedAt: now,
  };
  activeSessions.set(session.id, session);
  return session;
}

/**
 * Add a Pain Marker to an active (in-memory) session.
 */
export function addMarker(sessionId: string, marker: PainMarker): void {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  session.markers.push({ ...marker, sessionId });
  session.updatedAt = new Date();
}

/**
 * Add a Symptom Descriptor to an active (in-memory) session.
 */
export function addDescriptor(
  sessionId: string,
  descriptor: SymptomDescriptor
): void {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  session.descriptors.push(descriptor);
  session.updatedAt = new Date();
}

/**
 * Get an active session from the in-memory store (useful for testing).
 */
export function getActiveSession(sessionId: string): PainSession | undefined {
  return activeSessions.get(sessionId);
}

/**
 * Save a session to the database within a single transaction.
 * Persists the session, all markers, descriptors, and follow-up responses.
 */
export async function saveSession(
  sessionId: string,
  pool: Pool = defaultPool
): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    // Insert pain_session
    await client.query(
      `INSERT INTO pain_sessions (id, user_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET status = $3, updated_at = $5`,
      [session.id, session.userId, "completed", session.createdAt, new Date()]
    );

    // Insert markers
    for (const marker of session.markers) {
      await client.query(
        `INSERT INTO pain_markers (id, session_id, region_id, region_name, coordinates, boundary, intensity, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          marker.id,
          session.id,
          marker.location.region.id,
          marker.location.region.name,
          JSON.stringify(marker.location.coordinates),
          marker.boundary ? JSON.stringify(marker.boundary) : null,
          marker.intensity,
          marker.status,
          marker.createdAt,
        ]
      );
    }

    // Insert descriptors and their follow-up responses
    for (const descriptor of session.descriptors) {
      await client.query(
        `INSERT INTO symptom_descriptors (id, marker_id, pain_type, intensity, frequency, duration, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          descriptor.id,
          descriptor.markerId,
          descriptor.painType,
          descriptor.intensity,
          descriptor.frequency,
          descriptor.duration,
          descriptor.completedAt,
        ]
      );

      for (const resp of descriptor.followUpResponses) {
        await client.query(
          `INSERT INTO follow_up_responses (id, descriptor_id, question_id, question_text, response, answered_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [
            uuidv4(),
            descriptor.id,
            resp.questionId,
            resp.questionText,
            resp.response,
            resp.answeredAt,
          ]
        );
      }
    }

    await client.query("COMMIT");

    // Remove from in-memory store after successful persist
    activeSessions.delete(sessionId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Resume a session from the database, restoring all markers, descriptors,
 * and follow-up responses.
 */
export async function resumeSession(
  sessionId: string,
  pool: Pool = defaultPool
): Promise<PainSession> {
  // Check in-memory first
  const cached = activeSessions.get(sessionId);
  if (cached) {
    return cached;
  }

  const client: PoolClient = await pool.connect();
  try {
    // Load session
    const sessionResult = await client.query(
      "SELECT id, user_id, status, created_at, updated_at FROM pain_sessions WHERE id = $1",
      [sessionId]
    );
    if (sessionResult.rows.length === 0) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const row = sessionResult.rows[0];

    // Load markers
    const markersResult = await client.query(
      "SELECT id, session_id, region_id, region_name, coordinates, boundary, intensity, status, created_at FROM pain_markers WHERE session_id = $1",
      [sessionId]
    );

    const markers: PainMarker[] = markersResult.rows.map((m: any) => ({
      id: m.id,
      sessionId: m.session_id,
      location: {
        region: {
          id: m.region_id,
          name: m.region_name,
          bodySystem: "musculoskeletal", // default; not stored in DB
        },
        coordinates: m.coordinates,
      },
      boundary: m.boundary ?? undefined,
      intensity: m.intensity,
      createdAt: new Date(m.created_at),
      status: m.status,
    }));

    // Load descriptors
    const descriptorIds = markers.map((m) => m.id);
    let descriptors: SymptomDescriptor[] = [];

    if (descriptorIds.length > 0) {
      const descResult = await client.query(
        `SELECT id, marker_id, pain_type, intensity, frequency, duration, completed_at
         FROM symptom_descriptors WHERE marker_id = ANY($1)`,
        [descriptorIds]
      );

      descriptors = await Promise.all(
        descResult.rows.map(async (d: any) => {
          // Load follow-up responses for this descriptor
          const respResult = await client.query(
            `SELECT question_id, question_text, response, answered_at
             FROM follow_up_responses WHERE descriptor_id = $1 ORDER BY answered_at`,
            [d.id]
          );

          const followUpResponses: FollowUpResponse[] = respResult.rows.map(
            (r: any) => ({
              questionId: r.question_id,
              questionText: r.question_text,
              response: r.response,
              answeredAt: new Date(r.answered_at),
            })
          );

          return {
            id: d.id,
            markerId: d.marker_id,
            painType: d.pain_type,
            intensity: d.intensity,
            frequency: d.frequency,
            duration: d.duration,
            followUpResponses,
            completedAt: new Date(d.completed_at),
          } as SymptomDescriptor;
        })
      );
    }

    const session: PainSession = {
      id: row.id,
      userId: row.user_id,
      markers,
      descriptors,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };

    // Store in active sessions for further editing
    activeSessions.set(session.id, session);

    return session;
  } finally {
    client.release();
  }
}

/**
 * Clear all active sessions (useful for testing).
 */
export function clearActiveSessions(): void {
  activeSessions.clear();
}
