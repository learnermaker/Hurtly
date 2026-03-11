import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import type { PainMarker, AnatomicalLocation, SymptomDescriptor, FollowUpQuestion } from "@bodytrace/shared";
import BodyRendererSwitcher from "../components/BodyRendererSwitcher";
import CharacterizationPanel from "../components/CharacterizationPanel";
import { getApiClient, ApiError, OfflineError } from "../services/api-client";
import { DEMO_USER_ID } from "../config/constants";

export default function PainSessionPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentMarker, setCurrentMarker] = useState<PainMarker | null>(null);
  const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
  const [markers, setMarkers] = useState<PainMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sessionSaved, setSessionSaved] = useState(false);

  const handleStartSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setSessionSaved(false);
    try {
      const apiClient = getApiClient();
      const session = await apiClient.createSession(DEMO_USER_ID);
      setSessionId(session.id);
      setSuccessMessage("Session started! Click on the body model to mark pain locations.");
    } catch (err) {
      if (err instanceof OfflineError) {
        setOfflineMode(true);
        setError("You are offline. Session will be synced when connection is restored.");
      } else if (err instanceof ApiError) {
        setError(`API Error: ${err.message}`);
      } else {
        setError("Failed to create session");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePointSelect = useCallback(async (location: AnatomicalLocation) => {
    if (!sessionId) {
      setError("Please start a session first");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const marker: PainMarker = {
        id: crypto.randomUUID(),
        sessionId,
        location,
        intensity: 5,
        createdAt: new Date(),
        status: "active",
      };

      const apiClient = getApiClient();
      await apiClient.addMarker(sessionId, marker);
      
      setCurrentMarker(marker);
      setMarkers((prev) => [...prev, marker]);
      setSuccessMessage(`Pain marker added to ${location.region.name}`);
    } catch (err) {
      if (err instanceof OfflineError) {
        setOfflineMode(true);
        setError("You are offline. Changes will be synced when connection is restored.");
      } else if (err instanceof ApiError) {
        setError(`API Error: ${err.message}`);
      } else {
        setError("Failed to add marker");
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const handleCharacterizationComplete = useCallback(async (descriptor: SymptomDescriptor) => {
    if (!sessionId) {
      setError("Please start a session first");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const apiClient = getApiClient();
      
      await apiClient.addDescriptor(sessionId, descriptor);
      setSuccessMessage("Symptom characterized successfully!");

      try {
        const result = await apiClient.generateFollowUpQuestions(descriptor, DEMO_USER_ID);
        setFollowUpQuestions(result.questions);
      } catch (err) {
        const defaultResult = await apiClient.getDefaultQuestions();
        setFollowUpQuestions(defaultResult.questions);
      }

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
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const handleSaveSession = useCallback(async () => {
    if (!sessionId) {
      setError("No active session to save");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const apiClient = getApiClient();
      await apiClient.saveSession(sessionId);
      setSessionSaved(true);
      setSuccessMessage("Session saved successfully!");
    } catch (err) {
      if (err instanceof OfflineError) {
        setOfflineMode(true);
        setError("You are offline. Session will be saved when connection is restored.");
      } else if (err instanceof ApiError) {
        setError(`API Error: ${err.message}`);
      } else {
        setError("Failed to save session");
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const handleNewSession = useCallback(() => {
    setSessionId(null);
    setMarkers([]);
    setCurrentMarker(null);
    setFollowUpQuestions([]);
    setSuccessMessage(null);
    setSessionSaved(false);
    setError(null);
  }, []);

  return (
    <div>
      <div style={{
        backgroundColor: "#fff",
        padding: 24,
        borderRadius: 8,
        marginBottom: 24,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}>
        <h2 style={{ marginTop: 0, color: "#1565c0" }}>Track Pain Session</h2>
        <p style={{ color: "#666", marginBottom: 16 }}>
          Start a new session, mark pain locations on the 3D body model, and characterize your symptoms.
        </p>

        {/* Status Messages */}
        {offlineMode && (
          <div style={{
            padding: 12,
            marginBottom: 16,
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 4,
            color: "#856404",
          }}>
            ⚠️ Offline Mode - Changes will sync when connection is restored
          </div>
        )}

        {error && (
          <div style={{
            padding: 12,
            marginBottom: 16,
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: 4,
            color: "#721c24",
          }}>
            {error}
          </div>
        )}

        {successMessage && (
          <div style={{
            padding: 12,
            marginBottom: 16,
            backgroundColor: "#d4edda",
            border: "1px solid #c3e6cb",
            borderRadius: 4,
            color: "#155724",
          }}>
            ✓ {successMessage}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {!sessionId && !sessionSaved && (
            <button
              onClick={handleStartSession}
              disabled={loading}
              style={{
                padding: "12px 24px",
                fontSize: 16,
                backgroundColor: "#1565c0",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 500,
              }}
            >
              Start New Session
            </button>
          )}

          {sessionId && !sessionSaved && (
            <>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                backgroundColor: "#e8f5e9",
                border: "1px solid #4caf50",
                borderRadius: 20,
                fontSize: 14,
                color: "#2e7d32",
                fontWeight: 500,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4caf50", display: "inline-block" }} />
                Session Active — {markers.length} marker{markers.length !== 1 ? "s" : ""}
              </div>

              {markers.length > 0 && (
                <button
                  onClick={handleSaveSession}
                  disabled={loading}
                  style={{
                    padding: "12px 24px",
                    fontSize: 16,
                    backgroundColor: "#2e7d32",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    cursor: loading ? "not-allowed" : "pointer",
                    fontWeight: 500,
                  }}
                >
                  {loading ? "Saving..." : "Save Session"}
                </button>
              )}
            </>
          )}

          {sessionSaved && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{
                padding: "12px 20px",
                backgroundColor: "#d4edda",
                border: "1px solid #c3e6cb",
                borderRadius: 4,
                color: "#155724",
                fontWeight: 500,
              }}>
                ✓ Session saved
              </div>
              <Link to="/body-map" style={{
                padding: "12px 20px",
                backgroundColor: "#1565c0",
                color: "#fff",
                borderRadius: 4,
                textDecoration: "none",
                fontWeight: 500,
                fontSize: 14,
              }}>
                View Body Map →
              </Link>
              <Link to="/timeline" style={{
                padding: "12px 20px",
                backgroundColor: "#6a1b9a",
                color: "#fff",
                borderRadius: 4,
                textDecoration: "none",
                fontWeight: 500,
                fontSize: 14,
              }}>
                View Timeline →
              </Link>
              <button
                onClick={handleNewSession}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#fff",
                  color: "#1565c0",
                  border: "1px solid #1565c0",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: 500,
                  fontSize: 14,
                }}
              >
                Start New Session
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      {sessionId && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          {/* Body Model */}
          <div style={{ 
            flex: "1 1 500px",
            backgroundColor: "#fff",
            padding: 24,
            borderRadius: 8,
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}>
            <h3 style={{ marginTop: 0 }}>Select Pain Location</h3>
            <p style={{ color: "#666", fontSize: 14, marginBottom: 16 }}>
              Click on the 3D body model to mark where you're experiencing pain
            </p>
            <BodyRendererSwitcher
              markers={markers}
              onPointSelect={handlePointSelect}
              enableKeyboardNavigation={true}
            />
          </div>

          {/* Characterization Panel */}
          {currentMarker && (
            <div style={{ 
              flex: "1 1 400px",
              backgroundColor: "#fff",
              padding: 24,
              borderRadius: 8,
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            }}>
              <h3 style={{ marginTop: 0 }}>Characterize Pain</h3>
              <p style={{ color: "#666", fontSize: 14, marginBottom: 16 }}>
                Describe the pain you're experiencing at {currentMarker.location.region.name}
              </p>
              <CharacterizationPanel
                marker={currentMarker}
                followUpQuestions={followUpQuestions}
                onComplete={handleCharacterizationComplete}
              />
            </div>
          )}
        </div>
      )}

      {/* Markers Summary */}
      {markers.length > 0 && (
        <div style={{
          marginTop: 24,
          backgroundColor: "#fff",
          padding: 24,
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}>
          <h3 style={{ marginTop: 0 }}>Session Summary ({markers.length} markers)</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {markers.map((marker, index) => (
              <div
                key={marker.id}
                style={{
                  padding: 16,
                  border: "1px solid #e0e0e0",
                  borderRadius: 4,
                  backgroundColor: "#f9f9f9",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>Marker {index + 1}:</strong> {marker.location.region.name}
                  </div>
                  <div style={{
                    padding: "4px 12px",
                    backgroundColor: marker.intensity >= 7 ? "#f44336" : marker.intensity >= 4 ? "#ff9800" : "#4caf50",
                    color: "#fff",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 500,
                  }}>
                    Intensity: {marker.intensity}/10
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
