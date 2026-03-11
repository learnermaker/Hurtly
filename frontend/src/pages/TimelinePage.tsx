import { useState, useEffect } from "react";
import type { AnatomicalRegion } from "@bodytrace/shared";
import TimelineView from "../components/TimelineView";
import { getApiClient } from "../services/api-client";
import { DEMO_USER_ID } from "../config/constants";

export default function TimelinePage() {
  const [regions, setRegions] = useState<AnatomicalRegion[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<AnatomicalRegion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiClient = getApiClient();
      const bodyMap = await apiClient.getBodyMap(DEMO_USER_ID);

      // Extract unique regions from markers
      const regionMap = new Map<string, AnatomicalRegion>();
      bodyMap.markers.forEach(marker => {
        if (!regionMap.has(marker.location.region.id)) {
          regionMap.set(marker.location.region.id, marker.location.region);
        }
      });

      const uniqueRegions = Array.from(regionMap.values());
      setRegions(uniqueRegions);
      if (uniqueRegions.length > 0) {
        setSelectedRegion(uniqueRegions[0]);
      }
    } catch (err) {
      setError("Failed to load timeline data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

      {!loading && !error && regions.length > 0 && (
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
              value={selectedRegion?.id || ""}
              onChange={(e) => {
                const region = regions.find(r => r.id === e.target.value);
                if (region) setSelectedRegion(region);
              }}
              style={{
                padding: "8px 12px",
                fontSize: 14,
                border: "1px solid #ddd",
                borderRadius: 4,
                width: "100%",
                maxWidth: 300,
              }}
            >
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>

          {/* Timeline View */}
          {selectedRegion && (
            <div style={{
              backgroundColor: "#fff",
              padding: 24,
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}>
              <TimelineView
                userId={DEMO_USER_ID}
                region={selectedRegion}
              />
            </div>
          )}
        </>
      )}

      {!loading && !error && regions.length === 0 && (
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
