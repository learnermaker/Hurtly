/**
 * Example component demonstrating BodyMapView integration with API client
 */

import { useState, useEffect, useCallback } from "react";
import type { PainMarker, SymptomDescriptor, MarkerFilter } from "@bodytrace/shared";
import BodyMapView from "./BodyMapView";
import { getApiClient, ApiError, OfflineError } from "../services/api-client";

export default function BodyMapViewExample() {
  const [markers, setMarkers] = useState<PainMarker[]>([]);
  const [descriptors, setDescriptors] = useState<SymptomDescriptor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load body map data
  useEffect(() => {
    async function loadBodyMap() {
      setLoading(true);
      setError(null);

      try {
        const apiClient = getApiClient();
        const bodyMap = await apiClient.getBodyMap("demo-user-1");
        
        setMarkers(bodyMap.markers);
        setDescriptors(bodyMap.descriptors);
        console.log("Body map loaded:", bodyMap.markers.length, "markers");
      } catch (err) {
        if (err instanceof OfflineError) {
          setError("You are offline. Please reconnect to view your body map.");
        } else if (err instanceof ApiError) {
          setError(`API Error: ${err.message}`);
        } else {
          setError("Failed to load body map");
        }
        console.error("Error loading body map:", err);
      } finally {
        setLoading(false);
      }
    }

    loadBodyMap();
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback(async (filters: MarkerFilter) => {
    setLoading(true);
    setError(null);

    try {
      const apiClient = getApiClient();
      const result = await apiClient.filterBodyMap("demo-user-1", filters);
      
      setMarkers(result.markers);
      console.log("Filtered markers:", result.count);
    } catch (err) {
      if (err instanceof OfflineError) {
        setError("You are offline. Cannot apply filters.");
      } else if (err instanceof ApiError) {
        setError(`API Error: ${err.message}`);
      } else {
        setError("Failed to filter markers");
      }
      console.error("Error filtering markers:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  if (loading && markers.length === 0) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
        <h2>Body Map View</h2>
        <p>Loading body map data...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h2>Body Map View</h2>
      
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
          Applying filters...
        </div>
      )}

      <BodyMapView
        markers={markers}
        descriptors={descriptors}
        onFilterChange={handleFilterChange}
      />
    </div>
  );
}
