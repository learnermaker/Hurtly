/**
 * Example component demonstrating API client integration
 * 
 * This shows how to use the API client with the BodyModelRenderer
 * and CharacterizationPanel components.
 */

import { useState, useCallback } from "react";
import type { PainMarker, AnatomicalLocation, SymptomDescriptor, FollowUpQuestion } from "@bodytrace/shared";
import BodyModelRenderer from "./BodyModelRenderer";
import CharacterizationPanel from "./CharacterizationPanel";
import { getApiClient, ApiError, OfflineError } from "../services/api-client";

export default function PainSessionExample() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentMarker, setCurrentMarker] = useState<PainMarker | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [markers, setMarkers] = useState<PainMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);

  // Create a new session
  const handleStartSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiClient = getApiClient();
      const session = await apiClient.createSession("demo-user-1");
      setSessionId(session.id);
      console.log("Session created:", session.id);
    } catch (err) {
      if (err instanceof OfflineError) {
        setOfflineMode(true);
        setError("You are offline. Session will be synced when connection is restored.");
      } else if (err instanceof ApiError) {
        setError(`API Error: ${err.message}`);
      } else {
        setError("Failed to create session");
      }
      console.error("Error creating session:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle point selection on body model
  const handlePointSelect = useCallback(async (location: AnatomicalLocation) => {
    if (!sessionId) {
      setError("Please start a session first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const marker: PainMarker = {
        id: crypto.randomUUID(),
        sessionId,
        location,
        intensity: 5, // Default intensity
        createdAt: new Date(),
        status: "active",
      };

      const apiClient = getApiClient();
      await apiClient.addMarker(sessionId, marker);
      
      setCurrentMarker(marker);
      setMarkers((prev) => [...prev, marker]);
      console.log("Marker added:", marker.id);
    } catch (err) {
      if (err instanceof OfflineError) {
        setOfflineMode(true);
        setError("You are offline. Changes will be synced when connection is restored.");
      } else if (err instanceof ApiError) {
        setError(`API Error: ${err.message}`);
      } else {
        setError("Failed to add marker");
      }
      console.error("Error adding marker:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Handle characterization completion
  const handleCharacterizationComplete = useCallback(async (descriptor: SymptomDescriptor) => {
    if (!sessionId) {
      setError("Please start a session first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiClient = getApiClient();
      
      // Add descriptor to session
      await apiClient.addDescriptor(sessionId, descriptor);
      console.log("Descriptor added:", descriptor.id);

      // Generate follow-up questions
      try {
        const result = await apiClient.generateFollowUpQuestions(descriptor, "demo-user-1");
        setFollowUpQuestions(result.questions);
        console.log("Follow-up questions generated:", result.count);
      } catch (err) {
        console.warn("Failed to generate follow-up questions, using defaults:", err);
        const defaultResult = await apiClient.getDefaultQuestions();
        setFollowUpQuestions(defaultResult.questions);
      }

      // Clear current marker
      setCurrentMarker(null);
    } catch (err) {
      if (err instanceof OfflineError) {
        setOfflineMode(true);
        setError("You are offline. Changes will be synced when connection is restored.");
      } else if (err instanceof ApiError) {
        setError(`API Error: ${err.message}`);
      } else {
        setError("Failed to add descriptor");
      }
      console.error("Error adding descriptor:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Save session
  const handleSaveSession = useCallback(async () => {
    if (!sessionId) {
      setError("No active session to save");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiClient = getApiClient();
      await apiClient.saveSession(sessionId);
      console.log("Session saved:", sessionId);
      alert("Session saved successfully!");
    } catch (err) {
      if (err instanceof OfflineError) {
        setOfflineMode(true);
        setError("You are offline. Session will be saved when connection is restored.");
      } else if (err instanceof ApiError) {
        setError(`API Error: ${err.message}`);
      } else {
        setError("Failed to save session");
      }
      console.error("Error saving session:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h2>Pain Session Example</h2>
      
      {/* Status Bar */}
      <div style={{ 
        padding: 12, 
        marginBottom: 16, 
        backgroundColor: offlineMode ? "#fff3cd" : "#d1ecf1",
        border: `1px solid ${offlineMode ? "#ffc107" : "#bee5eb"}`,
        borderRadius: 4,
      }}>
        <div style={{ marginBottom: 4 }}>
          <strong>Status:</strong> {sessionId ? `Session ${sessionId}` : "No active session"}
        </div>
        {offlineMode && (
          <div style={{ color: "#856404" }}>
            ⚠️ Offline Mode - Changes will sync when connection is restored
          </div>
        )}
        {loading && <div>Loading...</div>}
        {error && <div style={{ color: "#721c24" }}>Error: {error}</div>}
      </div>

      {/* Controls */}
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        <button
          onClick={handleStartSession}
          disabled={loading || sessionId !== null}
          style={{
            padding: "10px 16px",
            fontSize: 14,
            backgroundColor: sessionId ? "#6c757d" : "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: sessionId ? "not-allowed" : "pointer",
            minHeight: "44px",
          }}
        >
          Start New Session
        </button>

        <button
          onClick={handleSaveSession}
          disabled={loading || !sessionId}
          style={{
            padding: "10px 16px",
            fontSize: 14,
            backgroundColor: sessionId ? "#28a745" : "#6c757d",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: sessionId ? "pointer" : "not-allowed",
            minHeight: "44px",
          }}
        >
          Save Session
        </button>
      </div>

      {/* Main Content */}
      <div style={{ display: "flex", gap: 16 }}>
        {/* Body Model */}
        <div style={{ flex: 1, minHeight: 500 }}>
          <h3>Select Pain Location</h3>
          <BodyModelRenderer
            markers={markers}
            onPointSelect={handlePointSelect}
            enableKeyboardNavigation={true}
          />
        </div>

        {/* Characterization Panel */}
        {currentMarker && (
          <div style={{ width: 400 }}>
            <h3>Characterize Pain</h3>
            <CharacterizationPanel
              marker={currentMarker}
              followUpQuestions={followUpQuestions}
              onComplete={handleCharacterizationComplete}
            />
          </div>
        )}
      </div>

      {/* Markers List */}
      {markers.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3>Recorded Markers ({markers.length})</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {markers.map((marker) => (
              <li
                key={marker.id}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  backgroundColor: "#f8f9fa",
                }}
              >
                <strong>{marker.location.region.name}</strong> - Intensity: {marker.intensity}/10
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
