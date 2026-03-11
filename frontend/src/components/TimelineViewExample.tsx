/**
 * Example component demonstrating TimelineView integration with API client
 */

import { useState, useEffect } from "react";
import type { AnatomicalRegion, TimelineData } from "@bodytrace/shared";
import TimelineView from "./TimelineView";
import { getApiClient, ApiError, OfflineError } from "../services/api-client";

export default function TimelineViewExample() {
  const [selectedRegion, setSelectedRegion] = useState<AnatomicalRegion>({
    id: "chest",
    name: "Chest",
    bodySystem: "musculoskeletal",
  });
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load timeline data
  useEffect(() => {
    async function loadTimeline() {
      setLoading(true);
      setError(null);

      try {
        const apiClient = getApiClient();
        const data = await apiClient.getTimeline("demo-user-1", selectedRegion);
        
        setTimelineData({
          region: data.region,
          entries: data.entries,
        });
        console.log("Timeline loaded:", data.entryCount, "entries, trend:", data.trend);
      } catch (err) {
        if (err instanceof OfflineError) {
          setError("You are offline. Please reconnect to view timeline data.");
        } else if (err instanceof ApiError) {
          setError(`API Error: ${err.message}`);
        } else {
          setError("Failed to load timeline");
        }
        console.error("Error loading timeline:", err);
      } finally {
        setLoading(false);
      }
    }

    loadTimeline();
  }, [selectedRegion]);

  // Available regions for selection
  const availableRegions: AnatomicalRegion[] = [
    { id: "chest", name: "Chest", bodySystem: "musculoskeletal" },
    { id: "lower-back", name: "Lower Back", bodySystem: "musculoskeletal" },
    { id: "left-shoulder", name: "Left Shoulder", bodySystem: "musculoskeletal" },
    { id: "right-knee", name: "Right Knee", bodySystem: "musculoskeletal" },
  ];

  if (loading && !timelineData) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
        <h2>Symptom Timeline</h2>
        <p>Loading timeline data...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h2>Symptom Timeline</h2>
      
      {/* Region Selector */}
      <div style={{ marginBottom: 16 }}>
        <label
          htmlFor="region-select"
          style={{ display: "block", fontWeight: 600, marginBottom: 8 }}
        >
          Select Region:
        </label>
        <select
          id="region-select"
          value={selectedRegion.id}
          onChange={(e) => {
            const region = availableRegions.find((r) => r.id === e.target.value);
            if (region) setSelectedRegion(region);
          }}
          style={{
            padding: "10px 12px",
            fontSize: 14,
            border: "1px solid #666",
            borderRadius: 4,
            minHeight: "44px",
            minWidth: "200px",
          }}
        >
          {availableRegions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          backgroundColor: "#f8d7da",
          border: "1px solid #f5c6cb",
          borderRadius: 4,
          color: "#721c24",
        }}>
          Error: {error}
        </div>
      )}

      {loading && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          backgroundColor: "#d1ecf1",
          border: "1px solid #bee5eb",
          borderRadius: 4,
        }}>
          Loading timeline...
        </div>
      )}

      {timelineData && (
        <TimelineView
          userId="demo-user-1"
          region={selectedRegion}
        />
      )}
    </div>
  );
}
