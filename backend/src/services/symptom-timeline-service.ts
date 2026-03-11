import {
  AnatomicalRegion,
  TimelineData,
  TimelineEntry,
  Trend,
  PainType,
} from "../../../shared/src/types";
import { Pool } from "pg";

export interface SymptomTimelineService {
  getTimeline(userId: string, region: AnatomicalRegion): Promise<TimelineData>;
  computeTrend(data: TimelineData): Trend;
}

export class SymptomTimelineServiceImpl implements SymptomTimelineService {
  constructor(private db: Pool) {}

  /**
   * Get timeline data for a specific anatomical region
   * Returns chronologically ordered timeline entries
   * Validates: Requirements 6.1, 6.2, 6.3
   */
  async getTimeline(
    userId: string,
    region: AnatomicalRegion
  ): Promise<TimelineData> {
    // Query pain_markers and symptom_descriptors for the given user and region
    const query = `
      SELECT 
        pm.created_at as date,
        sd.intensity,
        sd.pain_type,
        pm.id as marker_id
      FROM pain_markers pm
      INNER JOIN pain_sessions ps ON pm.session_id = ps.id
      INNER JOIN symptom_descriptors sd ON sd.marker_id = pm.id
      WHERE ps.user_id = $1 AND pm.region_id = $2
      ORDER BY pm.created_at ASC
    `;

    const result = await this.db.query(query, [userId, region.id]);

    // Build timeline entries with status tracking
    const entries: TimelineEntry[] = [];
    const painTypeTracker = new Map<PainType, Date>();

    for (const row of result.rows) {
      const painType = row.pain_type as PainType;
      const date = new Date(row.date);

      // Determine status
      let status: "appeared" | "active" | "resolved";
      if (!painTypeTracker.has(painType)) {
        // First occurrence
        status = "appeared";
        painTypeTracker.set(painType, date);
      } else {
        // Subsequent occurrence
        status = "active";
        painTypeTracker.set(painType, date);
      }

      entries.push({
        date,
        intensity: row.intensity,
        painType,
        status,
      });
    }

    // Mark resolved symptoms
    // A symptom is resolved if it hasn't appeared in the last entry
    // but appeared earlier in the timeline
    this.markResolvedSymptoms(entries);

    return {
      region,
      entries,
    };
  }

  /**
   * Mark symptoms as resolved when they stop appearing
   * A symptom is marked resolved when it's the last occurrence
   * and there are subsequent entries without it
   */
  private markResolvedSymptoms(entries: TimelineEntry[]): void {
    if (entries.length === 0) return;

    // Track the last occurrence of each pain type
    const lastOccurrence = new Map<PainType, number>();

    entries.forEach((entry, index) => {
      lastOccurrence.set(entry.painType, index);
    });

    // If a pain type's last occurrence is not the final entry,
    // mark it as resolved
    const finalIndex = entries.length - 1;
    lastOccurrence.forEach((lastIndex, painType) => {
      if (lastIndex < finalIndex) {
        entries[lastIndex].status = "resolved";
      }
    });
  }

  /**
   * Compute trend for timeline data
   * Returns "stable" for data spanning ≤ 7 days
   * Returns "worsening", "improving", or "stable" for data spanning > 7 days
   * Validates: Requirements 6.4
   */
  computeTrend(data: TimelineData): Trend {
    if (data.entries.length === 0) {
      return "stable";
    }

    // Calculate time span
    const sortedEntries = [...data.entries].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    const firstDate = sortedEntries[0].date;
    const lastDate = sortedEntries[sortedEntries.length - 1].date;
    const daysDiff =
      (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);

    // If data spans ≤ 7 days, return stable
    if (daysDiff <= 7) {
      return "stable";
    }

    // For data spanning > 7 days, compare early vs late period intensities
    // Split the timeline into early and late periods
    const midpoint = Math.floor(sortedEntries.length / 2);
    const earlyPeriod = sortedEntries.slice(0, midpoint);
    const latePeriod = sortedEntries.slice(midpoint);

    // Calculate average intensity for each period
    const earlyAvg =
      earlyPeriod.reduce((sum, entry) => sum + entry.intensity, 0) /
      earlyPeriod.length;
    const lateAvg =
      latePeriod.reduce((sum, entry) => sum + entry.intensity, 0) /
      latePeriod.length;

    // Determine trend based on intensity change
    const intensityChange = lateAvg - earlyAvg;
    const threshold = 0.5; // Minimum change to be considered a trend

    if (intensityChange > threshold) {
      return "worsening";
    } else if (intensityChange < -threshold) {
      return "improving";
    } else {
      return "stable";
    }
  }
}
