/**
 * Example component demonstrating InsightReportView integration with API client
 */

import { useState, useEffect } from "react";
import type { InsightReport } from "@bodytrace/shared";
import { getApiClient, ApiError, OfflineError } from "../services/api-client";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function getTrendColor(trend: "worsening" | "improving" | "stable"): string {
  switch (trend) {
    case "worsening":
      return "#d32f2f"; // red
    case "improving":
      return "#4caf50"; // green
    case "stable":
      return "#2196f3"; // blue
  }
}

export default function InsightReportViewExample() {
  const [report, setReport] = useState<InsightReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Generate report
  const handleGenerateReport = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiClient = getApiClient();
      const generatedReport = await apiClient.generateInsightReport("demo-user-1");
      
      setReport(generatedReport);
      console.log("Report generated:", generatedReport.id);
    } catch (err) {
      if (err instanceof OfflineError) {
        setError("You are offline. Please reconnect to generate a report.");
      } else if (err instanceof ApiError) {
        setError(`API Error: ${err.message}`);
      } else {
        setError("Failed to generate report");
      }
      console.error("Error generating report:", err);
    } finally {
      setLoading(false);
    }
  };

  // Export report as PDF
  const handleExportPDF = async () => {
    if (!report) return;

    setExporting(true);
    setError(null);

    try {
      const apiClient = getApiClient();
      const blob = await apiClient.exportReportPDF("demo-user-1");
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bodytrace-insight-report-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      console.log("PDF exported successfully");
    } catch (err) {
      if (err instanceof OfflineError) {
        setError("You are offline. Please reconnect to export the report.");
      } else if (err instanceof ApiError) {
        setError(`API Error: ${err.message}`);
      } else {
        setError("Failed to export PDF");
      }
      console.error("Error exporting PDF:", err);
    } finally {
      setExporting(false);
    }
  };

  const isEmpty = report && 
    report.patterns.length === 0 &&
    report.frequencyTrends.length === 0 &&
    report.intensityChanges.length === 0;

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: "#222", maxWidth: 900 }}>
      <h2>Insight Report</h2>

      {/* Controls */}
      <div style={{ marginBottom: 24, display: "flex", gap: 12 }}>
        <button
          onClick={handleGenerateReport}
          disabled={loading}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            backgroundColor: loading ? "#6c757d" : "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: loading ? "not-allowed" : "pointer",
            minHeight: "44px",
            minWidth: "150px",
          }}
        >
          {loading ? "Generating..." : "Generate Report"}
        </button>

        {report && (
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              backgroundColor: exporting ? "#6c757d" : "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: exporting ? "not-allowed" : "pointer",
              minHeight: "44px",
              minWidth: "150px",
            }}
          >
            {exporting ? "Exporting..." : "Export to PDF"}
          </button>
        )}
      </div>

      {/* Error Message */}
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

      {/* Report Content */}
      {report && (
        <div>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, fontSize: 24, marginBottom: 8 }}>
              BodyTrace Insight Report
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "#666" }}>
              Generated: {new Date(report.generatedAt).toLocaleDateString()}
            </p>
          </div>

          {isEmpty ? (
            <div style={{
              padding: 40,
              textAlign: "center",
              backgroundColor: "#f5f5f5",
              borderRadius: 8,
              color: "#666",
              marginBottom: 24,
            }}>
              <p style={{ margin: 0, fontSize: 14 }}>
                No symptom data available yet. Start recording your symptoms to generate insights.
              </p>
            </div>
          ) : (
            <>
              {/* Symptom Patterns */}
              <section style={{ marginBottom: 32 }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 20 }}>Symptom Patterns</h3>
                {report.patterns.length === 0 ? (
                  <p style={{ color: "#555", fontSize: 14 }}>No patterns identified.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {report.patterns.map((pattern, index) => (
                      <div
                        key={index}
                        style={{
                          padding: 16,
                          border: "1px solid #666",
                          borderRadius: 8,
                          backgroundColor: "#fff",
                        }}
                      >
                        <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>
                          {pattern.description}
                        </p>
                        <div style={{ fontSize: 13, color: "#555" }}>
                          <div style={{ marginBottom: 4 }}>
                            <strong>Affected Regions:</strong> {pattern.regions.join(", ")}
                          </div>
                          <div>
                            <strong>Pain Types:</strong> {pattern.painTypes.map(capitalize).join(", ")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Frequency Trends */}
              <section style={{ marginBottom: 32 }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 20 }}>Frequency Trends</h3>
                {report.frequencyTrends.length === 0 ? (
                  <p style={{ color: "#555", fontSize: 14 }}>No frequency trends identified.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {report.frequencyTrends.map((trend, index) => {
                      const trendColor = getTrendColor(trend.trend);
                      return (
                        <div
                          key={index}
                          style={{
                            padding: 16,
                            border: "1px solid #666",
                            borderRadius: 8,
                            backgroundColor: "#fff",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>
                              {trend.region}
                            </p>
                            <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
                              Based on {trend.dataPoints} data point{trend.dataPoints !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <div
                            style={{
                              padding: "8px 16px",
                              borderRadius: 4,
                              backgroundColor: trendColor,
                              color: "#fff",
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            {capitalize(trend.trend)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Intensity Changes */}
              <section style={{ marginBottom: 32 }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 20 }}>Intensity Changes</h3>
                {report.intensityChanges.length === 0 ? (
                  <p style={{ color: "#555", fontSize: 14 }}>No significant intensity changes identified.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {report.intensityChanges.map((change, index) => {
                      const direction = change.toIntensity > change.fromIntensity ? "increased" : "decreased";
                      const changeColor = direction === "increased" ? "#d32f2f" : "#4caf50";
                      
                      return (
                        <div
                          key={index}
                          style={{
                            padding: 16,
                            border: "1px solid #666",
                            borderRadius: 8,
                            backgroundColor: "#fff",
                          }}
                        >
                          <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>
                            {change.region}
                          </p>
                          <div style={{ fontSize: 13, color: "#555" }}>
                            <div style={{ marginBottom: 4 }}>
                              Pain intensity{" "}
                              <span style={{ color: changeColor, fontWeight: 600 }}>
                                {direction}
                              </span>{" "}
                              from {change.fromIntensity}/10 to {change.toIntensity}/10
                            </div>
                            <div>
                              <strong>Period:</strong>{" "}
                              {new Date(change.period.start).toLocaleDateString()} -{" "}
                              {new Date(change.period.end).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}

          {/* Disclaimer */}
          <div style={{
            padding: 16,
            backgroundColor: "#fff3e0",
            border: "1px solid #ffb74d",
            borderRadius: 8,
            marginTop: 32,
          }}>
            <p style={{ margin: 0, fontSize: 13, color: "#e65100", fontWeight: 600 }}>
              ⚠️ Disclaimer
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#666" }}>
              {report.disclaimer}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
