import { useState, useEffect } from "react";
import type { InsightReport, BodyMap } from "@bodytrace/shared";

export interface InsightReportViewProps {
  userId: string;
  onClose?: () => void;
}

// Mock service - will be wired to API later
class MockInsightReportGenerator {
  async generate(bodyMap: BodyMap): Promise<InsightReport> {
    // Import the real generator dynamically
    const { InsightReportGenerator } = await import("../../../backend/src/services/insight-report-generator");
    const generator = new InsightReportGenerator();
    return generator.generate(bodyMap);
  }

  async exportPDF(report: InsightReport): Promise<Buffer> {
    // Import the real generator dynamically
    const { InsightReportGenerator } = await import("../../../backend/src/services/insight-report-generator");
    const generator = new InsightReportGenerator();
    return generator.exportPDF(report);
  }
}

const mockGenerator = new MockInsightReportGenerator();

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

export default function InsightReportView({ userId, onClose }: InsightReportViewProps) {
  const [report, setReport] = useState<InsightReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);
        
        // Mock body map data - will be fetched from API later
        const mockBodyMap: BodyMap = {
          userId,
          sessions: [],
          markers: [],
          descriptors: [],
        };
        
        const generatedReport = await mockGenerator.generate(mockBodyMap);
        setReport(generatedReport);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate report");
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [userId]);

  const handleExportPDF = async () => {
    if (!report) return;

    try {
      setExporting(true);
      const pdfBuffer = await mockGenerator.exportPDF(report);
      
      // Create a blob and download
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bodytrace-insight-report-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
        <p>Generating insight report...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: "#d32f2f" }}>
        <p>Error: {error}</p>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  const isEmpty = 
    report.patterns.length === 0 &&
    report.frequencyTrends.length === 0 &&
    report.intensityChanges.length === 0;

  return (
    <div
      role="region"
      aria-label="Insight Report"
      style={{
        padding: 20,
        fontFamily: "system-ui, sans-serif",
        color: "#222",
        maxWidth: 900,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, marginBottom: 8 }}>
            BodyTrace Insight Report
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#666" }}>
            Generated: {new Date(report.generatedAt).toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            aria-label="Export report to PDF"
            aria-disabled={exporting}
            style={{
              padding: "10px 20px",
              fontSize: 14,
              border: "1px solid #1565c0",
              borderRadius: 4,
              backgroundColor: "#1565c0",
              color: "#fff",
              cursor: exporting ? "not-allowed" : "pointer",
              opacity: exporting ? 0.6 : 1,
              minHeight: "44px", // WCAG touch target size
              minWidth: "120px",
            }}
          >
            {exporting ? "Exporting..." : "Export to PDF"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close report"
              style={{
                padding: "10px 20px",
                fontSize: 14,
                border: "1px solid #666",
                borderRadius: 4,
                backgroundColor: "#fff",
                cursor: "pointer",
                minHeight: "44px", // WCAG touch target size
                minWidth: "80px",
                color: "#222", // Ensure text contrast
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            backgroundColor: "#f5f5f5",
            borderRadius: 8,
            color: "#666",
            marginBottom: 24,
          }}
        >
          <p style={{ margin: 0, fontSize: 14 }}>
            No symptom data available yet. Start recording your symptoms to generate insights.
          </p>
        </div>
      ) : (
        <>
          {/* Symptom Patterns Section */}
          <section style={{ marginBottom: 32 }} aria-labelledby="patterns-heading">
            <h2 id="patterns-heading" style={{ margin: "0 0 16px", fontSize: 20, color: "#222" }}>
              Symptom Patterns
            </h2>
            {report.patterns.length === 0 ? (
              <p style={{ color: "#555", fontSize: 14 }}>No patterns identified.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {report.patterns.map((pattern, index) => (
                  <div
                    key={index}
                    role="article"
                    aria-label={`Pattern ${index + 1}: ${pattern.description}`}
                    style={{
                      padding: 16,
                      border: "1px solid #666",
                      borderRadius: 8,
                      backgroundColor: "#fff",
                    }}
                  >
                    <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600, color: "#222" }}>
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

          {/* Frequency Trends Section */}
          <section style={{ marginBottom: 32 }} aria-labelledby="trends-heading">
            <h2 id="trends-heading" style={{ margin: "0 0 16px", fontSize: 20, color: "#222" }}>
              Frequency Trends
            </h2>
            {report.frequencyTrends.length === 0 ? (
              <p style={{ color: "#555", fontSize: 14 }}>No frequency trends identified.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {report.frequencyTrends.map((trend, index) => {
                  const trendColor = getTrendColor(trend.trend);
                  return (
                    <div
                      key={index}
                      role="article"
                      aria-label={`Frequency trend for ${trend.region}: ${capitalize(trend.trend)}`}
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
                        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: "#222" }}>
                          {trend.region}
                        </p>
                        <p style={{ margin: 0, fontSize: 13, color: "#555" }}>
                          Based on {trend.dataPoints} data point{trend.dataPoints !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div
                        role="status"
                        aria-label={`Trend: ${capitalize(trend.trend)}`}
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

          {/* Intensity Changes Section */}
          <section style={{ marginBottom: 32 }} aria-labelledby="intensity-heading">
            <h2 id="intensity-heading" style={{ margin: "0 0 16px", fontSize: 20, color: "#222" }}>
              Intensity Changes
            </h2>
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
                      role="article"
                      aria-label={`Intensity change for ${change.region}: ${direction} from ${change.fromIntensity} to ${change.toIntensity}`}
                      style={{
                        padding: 16,
                        border: "1px solid #666",
                        borderRadius: 8,
                        backgroundColor: "#fff",
                      }}
                    >
                      <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600, color: "#222" }}>
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
      <div
        style={{
          padding: 16,
          backgroundColor: "#fff3e0",
          border: "1px solid #ffb74d",
          borderRadius: 8,
          marginTop: 32,
        }}
        role="note"
        aria-label="Disclaimer"
      >
        <p style={{ margin: 0, fontSize: 13, color: "#e65100", fontWeight: 600 }}>
          ⚠️ Disclaimer
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "#666" }}>
          {report.disclaimer}
        </p>
      </div>
    </div>
  );
}
