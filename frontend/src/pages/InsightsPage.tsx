import { useState, useEffect } from "react";
import type { InsightReport } from "@bodytrace/shared";
import InsightReportView from "../components/InsightReportView";
import { getApiClient } from "../services/api-client";
import { DEMO_USER_ID } from "../config/constants";

export default function InsightsPage() {
  const [report, setReport] = useState<InsightReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadLatestReport();
  }, []);

  const loadLatestReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiClient = getApiClient();
      // Try to get the latest report
      // In a real app, you'd have an endpoint to get the latest report
      // For now, we'll just show a message to generate one
      setLoading(false);
    } catch (err) {
      setError("Failed to load report");
      console.error(err);
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    setError(null);
    try {
      const apiClient = getApiClient();
      const newReport = await apiClient.generateInsightReport(DEMO_USER_ID);
      setReport(newReport);
    } catch (err) {
      setError("Failed to generate report");
      console.error(err);
    } finally {
      setGenerating(false);
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
        <h2 style={{ marginTop: 0, color: "#7b1fa2" }}>Health Insights</h2>
        <p style={{ color: "#666", marginBottom: 16 }}>
          AI-generated analysis of your health patterns with trends and recommendations.
        </p>

        {!report && (
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            style={{
              padding: "12px 24px",
              fontSize: 16,
              backgroundColor: "#7b1fa2",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: generating ? "not-allowed" : "pointer",
              fontWeight: 500,
            }}
          >
            {generating ? "Generating Report..." : "Generate Insight Report"}
          </button>
        )}
      </div>

      {loading && (
        <div style={{
          backgroundColor: "#fff",
          padding: 48,
          borderRadius: 8,
          textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}>
          <p style={{ color: "#666" }}>Loading insights...</p>
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

      {!loading && !error && report && (
        <div style={{
          backgroundColor: "#fff",
          padding: 24,
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}>
          <InsightReportView report={report} />
        </div>
      )}

      {!loading && !error && !report && !generating && (
        <div style={{
          backgroundColor: "#fff",
          padding: 48,
          borderRadius: 8,
          textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💡</div>
          <h3 style={{ color: "#666" }}>No insights yet</h3>
          <p style={{ color: "#999", marginBottom: 24 }}>
            Generate an insight report to see AI-powered analysis of your health patterns
          </p>
        </div>
      )}
    </div>
  );
}
