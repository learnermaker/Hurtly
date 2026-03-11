import { useState, useEffect } from "react";
import type { BodyMap, BodyMapFilters } from "@bodytrace/shared";
import BodyMapView from "../components/BodyMapView";
import { getApiClient } from "../services/api-client";
import { DEMO_USER_ID } from "../config/constants";

export default function BodyMapPage() {
  const [bodyMap, setBodyMap] = useState<BodyMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BodyMapFilters>({});

  useEffect(() => {
    loadBodyMap();
  }, []);

  const loadBodyMap = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiClient = getApiClient();
      const map = await apiClient.getBodyMap(DEMO_USER_ID);
      setBodyMap(map);
    } catch (err) {
      setError("Failed to load body map");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters: BodyMapFilters) => {
    setFilters(newFilters);
    // In a real app, this would trigger a new API call
    loadBodyMap();
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
        <h2 style={{ marginTop: 0, color: "#2e7d32" }}>Body Map</h2>
        <p style={{ color: "#666", marginBottom: 0 }}>
          View all your historical pain markers with filtering by date, type, intensity, and body region.
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
          <p style={{ color: "#666" }}>Loading body map...</p>
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

      {!loading && !error && bodyMap && (
        <div style={{
          backgroundColor: "#fff",
          padding: 24,
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}>
          <BodyMapView
            markers={bodyMap.markers}
            descriptors={bodyMap.descriptors}
            onFilterChange={handleFilterChange}
          />
        </div>
      )}

      {!loading && !error && bodyMap && bodyMap.markers.length === 0 && (
        <div style={{
          backgroundColor: "#fff",
          padding: 48,
          borderRadius: 8,
          textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginTop: 24,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📍</div>
          <h3 style={{ color: "#666" }}>No pain markers yet</h3>
          <p style={{ color: "#999" }}>
            Start tracking your symptoms by creating a new pain session
          </p>
        </div>
      )}
    </div>
  );
}
