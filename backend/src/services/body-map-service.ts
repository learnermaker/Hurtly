import type { Pool } from "pg";
import type {
  BodyMap,
  PainMarker,
  PainSession,
  SymptomDescriptor,
  FollowUpResponse,
  MarkerFilter,
  AnatomicalRegion,
} from "@bodytrace/shared";
import defaultPool from "../db/index.js";

// ---------------------------------------------------------------------------
// Pure in-memory filter (no DB) – exported for property-based testing
// ---------------------------------------------------------------------------

/**
 * Filter markers in memory using the provided filter criteria.
 * A marker passes the filter only if it satisfies ALL specified criteria.
 * Descriptors are used to resolve painType filters (painType lives on the
 * descriptor, not the marker).
 */
export function filterMarkersInMemory(
  markers: PainMarker[],
  descriptors: SymptomDescriptor[],
  filters: MarkerFilter
): PainMarker[] {
  const descriptorByMarkerId = new Map(
    descriptors.map((d) => [d.markerId, d])
  );

  return markers.filter((marker) => {
    // Date range filter
    if (filters.dateRange) {
      const created = marker.createdAt.getTime();
      if (
        created < filters.dateRange.start.getTime() ||
        created > filters.dateRange.end.getTime()
      ) {
        return false;
      }
    }

    // Pain type filter (requires matching descriptor)
    if (filters.painTypes && filters.painTypes.length > 0) {
      const desc = descriptorByMarkerId.get(marker.id);
      if (!desc || !filters.painTypes.includes(desc.painType)) {
        return false;
      }
    }

    // Intensity range filter
    if (filters.intensityRange) {
      if (
        marker.intensity < filters.intensityRange.min ||
        marker.intensity > filters.intensityRange.max
      ) {
        return false;
      }
    }

    // Anatomical region filter
    if (filters.regions && filters.regions.length > 0) {
      if (!filters.regions.includes(marker.location.region.id)) {
        return false;
      }
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Database-backed helpers
// ---------------------------------------------------------------------------

function rowToMarker(row: any): PainMarker {
  return {
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
}

function rowToDescriptor(row: any, followUpResponses: FollowUpResponse[]): SymptomDescriptor {
  return {
    id: row.id,
    markerId: row.marker_id,
    painType: row.pain_type,
    intensity: row.intensity,
    frequency: row.frequency,
    duration: row.duration,
    followUpResponses,
    completedAt: new Date(row.completed_at),
  };
}

// ---------------------------------------------------------------------------
// Body Map Service
// ---------------------------------------------------------------------------

/**
 * Aggregate all markers and descriptors across sessions for a user.
 */
export async function getBodyMap(
  userId: string,
  pool: Pool = defaultPool
): Promise<BodyMap> {
  const client = await pool.connect();
  try {
    // Load sessions
    const sessionsResult = await client.query(
      `SELECT id, user_id, status, created_at, updated_at
       FROM pain_sessions WHERE user_id = $1 ORDER BY created_at`,
      [userId]
    );

    // Load all markers for those sessions
    const sessionIds = sessionsResult.rows.map((s: any) => s.id);
    let allMarkers: PainMarker[] = [];
    let allDescriptors: SymptomDescriptor[] = [];

    if (sessionIds.length > 0) {
      const markersResult = await client.query(
        `SELECT id, session_id, region_id, region_name, coordinates, boundary, intensity, status, created_at
         FROM pain_markers WHERE session_id = ANY($1) ORDER BY created_at`,
        [sessionIds]
      );
      allMarkers = markersResult.rows.map(rowToMarker);

      // Load descriptors for all markers
      const markerIds = allMarkers.map((m) => m.id);
      if (markerIds.length > 0) {
        const descResult = await client.query(
          `SELECT id, marker_id, pain_type, intensity, frequency, duration, completed_at
           FROM symptom_descriptors WHERE marker_id = ANY($1)`,
          [markerIds]
        );

        // Load follow-up responses for all descriptors
        const descIds = descResult.rows.map((d: any) => d.id);
        let respMap = new Map<string, FollowUpResponse[]>();
        if (descIds.length > 0) {
          const respResult = await client.query(
            `SELECT descriptor_id, question_id, question_text, response, answered_at
             FROM follow_up_responses WHERE descriptor_id = ANY($1) ORDER BY answered_at`,
            [descIds]
          );
          for (const r of respResult.rows) {
            const list = respMap.get(r.descriptor_id) ?? [];
            list.push({
              questionId: r.question_id,
              questionText: r.question_text,
              response: r.response,
              answeredAt: new Date(r.answered_at),
            });
            respMap.set(r.descriptor_id, list);
          }
        }

        allDescriptors = descResult.rows.map((d: any) =>
          rowToDescriptor(d, respMap.get(d.id) ?? [])
        );
      }
    }

    // Build per-session data
    const sessions: PainSession[] = sessionsResult.rows.map((s: any) => {
      const sessionMarkers = allMarkers.filter((m) => m.sessionId === s.id);
      const sessionMarkerIds = new Set(sessionMarkers.map((m) => m.id));
      const sessionDescriptors = allDescriptors.filter((d) =>
        sessionMarkerIds.has(d.markerId)
      );
      return {
        id: s.id,
        userId: s.user_id,
        markers: sessionMarkers,
        descriptors: sessionDescriptors,
        status: s.status,
        createdAt: new Date(s.created_at),
        updatedAt: new Date(s.updated_at),
      } as PainSession;
    });

    return {
      userId,
      sessions,
      markers: allMarkers,
      descriptors: allDescriptors,
    };
  } finally {
    client.release();
  }
}

/**
 * Filter markers by criteria (date range, pain type, intensity range, region).
 * Builds a dynamic SQL query.
 */
export async function filterMarkers(
  userId: string,
  filters: MarkerFilter,
  pool: Pool = defaultPool
): Promise<PainMarker[]> {
  const conditions: string[] = ["ps.user_id = $1"];
  const params: any[] = [userId];
  let paramIdx = 2;

  // Join with descriptors only when filtering by pain type
  const needsDescJoin =
    filters.painTypes && filters.painTypes.length > 0;

  if (filters.dateRange) {
    conditions.push(`pm.created_at >= $${paramIdx}`);
    params.push(filters.dateRange.start);
    paramIdx++;
    conditions.push(`pm.created_at <= $${paramIdx}`);
    params.push(filters.dateRange.end);
    paramIdx++;
  }

  if (filters.intensityRange) {
    conditions.push(`pm.intensity >= $${paramIdx}`);
    params.push(filters.intensityRange.min);
    paramIdx++;
    conditions.push(`pm.intensity <= $${paramIdx}`);
    params.push(filters.intensityRange.max);
    paramIdx++;
  }

  if (filters.regions && filters.regions.length > 0) {
    conditions.push(`pm.region_id = ANY($${paramIdx})`);
    params.push(filters.regions);
    paramIdx++;
  }

  if (needsDescJoin) {
    conditions.push(`sd.pain_type = ANY($${paramIdx})`);
    params.push(filters.painTypes);
    paramIdx++;
  }

  const descJoin = needsDescJoin
    ? "JOIN symptom_descriptors sd ON sd.marker_id = pm.id"
    : "";

  const sql = `
    SELECT pm.id, pm.session_id, pm.region_id, pm.region_name,
           pm.coordinates, pm.boundary, pm.intensity, pm.status, pm.created_at
    FROM pain_markers pm
    JOIN pain_sessions ps ON ps.id = pm.session_id
    ${descJoin}
    WHERE ${conditions.join(" AND ")}
    ORDER BY pm.created_at
  `;

  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows.map(rowToMarker);
  } finally {
    client.release();
  }
}

/**
 * Get all markers for a specific anatomical region (for timeline data).
 */
export async function getMarkersByRegion(
  userId: string,
  region: AnatomicalRegion,
  pool: Pool = defaultPool
): Promise<PainMarker[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT pm.id, pm.session_id, pm.region_id, pm.region_name,
              pm.coordinates, pm.boundary, pm.intensity, pm.status, pm.created_at
       FROM pain_markers pm
       JOIN pain_sessions ps ON ps.id = pm.session_id
       WHERE ps.user_id = $1 AND pm.region_id = $2
       ORDER BY pm.created_at`,
      [userId, region.id]
    );
    return result.rows.map(rowToMarker);
  } finally {
    client.release();
  }
}
