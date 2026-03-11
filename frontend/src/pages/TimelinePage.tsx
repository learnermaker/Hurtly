import { useState, useEffect } from "react";
import type { TimelineData, BodyMap } from "@bodytrace/shared";
import TimelineView from "../components/TimelineView";
import { getApiClient } from "../services/api-client";
import { DEMO_USER_ID } from "../config/constants";

export default function TimelinePage() {
  const [timelines, setTimelines] = useState<TimelineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  useEffect(() => {
    loadTimelines();
  }, []);

  const loadTimelines = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiClient = getApiClient();
      
      // First get the body map to see which regions have data
      const bodyMap = await apiClient.getBodyMap(DEMO_USER_ID);
      
      // Get unique regions from markers
      const regions = new Map<string, { id: string; name: string }>();
      bodyMap.markers.forEach(marker => {
        if (!regions.has(marker.location.region.id)) {
          regions.set(marker.location.region.id, {
            id: marker.location.region.id,
            name: marker.location.region.name,
          });
        }
      });

      // Load timeline for each region
      const timelinePromises = Array.from(regions.values()).map(async (region) => {
        try {
          return await apiClient.getTimeline(DEMO_USER_ID, {
            id: region.id,
            name: region.name,
            bodySystem: "musculoskeletal",
          });
        } catch (err) {
          console.error(`Failed to load timeline for ${region.name}:`, err);
          return null;
        }
      });

      const timelineResults = await Promise.all(timelinePromises);
      const validTimelines = timelineResults.filter((t): t is TimelineData => t !== null && t.entries.length > 0);
      
      setTimelines(validTimelines);
      if (validTimelines.length > 0) {
        setSelectedRegion(validTimelines[0].region.id);
      }
    } catch (err) {
      setError("Failed to load timeline data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedTimeline = timelines.find(t => t.region.id === selectedRegion);

  return (
    <div>
      <div style={{
        backgroundColor: "#fff",
        padding: 24,
        borderRadius: 8,
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}>
        <h2 style={{ marginTop: 0, color: "#f57c00" }}>Symptom Timeline</h2>
        <p style={{ color: "#666", marginBottom: 0 }}>
          View chronological symptom progression with trends and intensity changes over time.
        </p>
      </div>

      {loading && (
        <div style={{
          backgroundColor: "#fff",
          padding: 48,
          borderRadius: 8,
          textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}>
          <p style={{ color: "#666" }}>Loading timeline...</p>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: "#fff",
          padding: 24,
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}>
          <div style={{
            padding: 16,
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: 4,
            color: "#721c24",
          }}>
            {error}
          </div>
        </div>
      )}

      {!loading && !error && timelines.length > 0 && (
        <>
          {/* Region Selector */}
          <div style={{
            backgroundColor: "#fff",
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}>
            <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
              Select Region:
            </label>
            <select
              value={selectedRegion || ""}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{
                padding: "8px 12px",
                fontSize: 14,
                border: "1px solid #ddd",
                borderRadius: 4,
                width: "100%",
                maxWidth: 300,
              }}
            >
              {timelines.map((timeline) => (
                <option key={timeline.region.id} value={timeline.region.id}>
                  {timeline.region.name} ({timeline.entries.length} entries)
                </option>
              ))}
            </select>
          </div>

          {/* Timeline View */}
          {selectedTimeline && (
            <div style={{
              backgroundColor: "#fff",
              padding: 24,
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}>
              <TimelineView timeline={selectedTimeline} />
            </div>
          )}
        </>
      )}

      {!loading && !error && timelines.length === 0 && (
        <div style={{
          backgroundColor: "#fff",
          padding: 48,
          borderRadius: 8,
          textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <h3 style={{ color: "#666" }}>No timeline data yet</h3>
          <p style={{ color: "#999" }}>
            Track symptoms over time to see your health progression
          </p>
        </div>
      )}
    </div>
  );
}
