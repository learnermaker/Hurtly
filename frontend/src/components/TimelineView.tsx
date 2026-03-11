import { useState, useEffect } from "react";
import type { AnatomicalRegion, TimelineData, TimelineEntry } from "@bodytrace/shared";
import { getApiClient } from "../services/api-client";

function getStatusColor(status: "appeared" | "active" | "resolved"): string {
  switch (status) {
    case "appeared":
      return "#4caf50"; // green
    case "active":
      return "#2196f3"; // blue
    case "resolved":
      return "#9e9e9e"; // gray
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

export interface TimelineViewProps {
  userId: string;
  region: AnatomicalRegion;
  onClose?: () => void;
}

function computeTrend(data: TimelineData): "worsening" | "improving" | "stable" {
  if (data.entries.length === 0) return "stable";
  const sortedEntries = [...data.entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstDate = sortedEntries[0].date;
  const lastDate = sortedEntries[sortedEntries.length - 1].date;
  const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff <= 7) return "stable";
  const midpoint = Math.floor(sortedEntries.length / 2);
  const earlyAvg = sortedEntries.slice(0, midpoint).reduce((s, e) => s + e.intensity, 0) / midpoint;
  const lateAvg = sortedEntries.slice(midpoint).reduce((s, e) => s + e.intensity, 0) / (sortedEntries.length - midpoint);
  const diff = lateAvg - earlyAvg;
  if (diff > 0.5) return "worsening";
  if (diff < -0.5) return "improving";
  return "stable";
}

export default function TimelineView({ userId, region, onClose }: TimelineViewProps) {
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        setLoading(true);
        setError(null);
        const apiData = await getApiClient().getTimeline(userId, region);
        // Normalize dates from API (they come as strings)
        const data: TimelineData = {
          region: apiData.region,
          entries: apiData.entries.map((e) => ({ ...e, date: new Date(e.date) })),
        };
        setTimelineData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load timeline");
      } finally {
        setLoading(false);
      }
    }

    fetchTimeline();
  }, [userId, region]);

  if (loading) {
    return (
      <div style={{ padding: 20, fontFamily: "system-ui, sans-serif" }}>
        <p>Loading timeline...</p>
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

  if (!timelineData) {
    return null;
  }

  const { entries } = timelineData;
  const isEmpty = entries.length === 0;

  // Calculate if we should show trend
  const sortedEntries = [...entries].sort((a, b) => a.date.getTime() - b.date.getTime());
  const showTrend = sortedEntries.length > 0 && (() => {
    const firstDate = sortedEntries[0].date;
    const lastDate = sortedEntries[sortedEntries.length - 1].date;
    const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 7;
  })();

  const trend = showTrend ? computeTrend(timelineData) : null;

  // Prepare data for the intensity graph
  const graphData = sortedEntries.map((entry) => ({
    date: entry.date,
    intensity: entry.intensity,
  }));

  return (
    <div
      role="region"
      aria-label={`Timeline for ${region.name}`}
      style={{
        padding: 20,
        fontFamily: "system-ui, sans-serif",
        color: "#222",
        maxWidth: 800,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>
          Symptom Timeline: {region.name}
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close timeline"
            style={{
              padding: "10px 16px",
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

      {isEmpty ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            backgroundColor: "#f5f5f5",
            borderRadius: 8,
            color: "#666",
          }}
        >
          <p style={{ margin: 0, fontSize: 14 }}>
            No symptom data recorded for this region yet.
          </p>
        </div>
      ) : (
        <>
          {/* Trend Indicator */}
          {showTrend && trend && (
            <div
              role="status"
              aria-label={`Symptom trend: ${capitalize(trend)}`}
              style={{
                padding: 12,
                marginBottom: 16,
                backgroundColor: "#e3f2fd",
                borderRadius: 6,
                border: "1px solid #1565c0",
              }}
            >
              <strong style={{ fontSize: 14, color: "#222" }}>Trend:</strong>{" "}
              <span style={{ fontSize: 14, color: "#222" }}>{capitalize(trend)}</span>
            </div>
          )}

          {/* Intensity Graph */}
          {graphData.length > 0 && (
            <div
              style={{
                marginBottom: 24,
                padding: 16,
                backgroundColor: "#fafafa",
                borderRadius: 8,
                border: "1px solid #e0e0e0",
              }}
            >
              <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Intensity Over Time</h3>
              <IntensityGraph data={graphData} />
            </div>
          )}

          {/* Timeline Entries */}
          <div>
            <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>Timeline Entries</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sortedEntries.map((entry, index) => (
                <TimelineEntryCard key={index} entry={entry} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface TimelineEntryCardProps {
  entry: TimelineEntry;
}

function TimelineEntryCard({ entry }: TimelineEntryCardProps) {
  const statusColor = getStatusColor(entry.status);

  return (
    <div
      role="article"
      aria-label={`Timeline entry for ${formatDate(entry.date)}`}
      style={{
        padding: 12,
        border: "1px solid #666",
        borderRadius: 6,
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Status Indicator */}
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: statusColor,
          flexShrink: 0,
        }}
        role="img"
        aria-label={`Status: ${entry.status}`}
      />

      {/* Entry Details */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#222" }}>
          {formatDate(entry.date)}
        </div>
        <div style={{ fontSize: 12, color: "#555" }}>
          <span>
            <strong>Pain Type:</strong> {capitalize(entry.painType)}
          </span>
          {" • "}
          <span>
            <strong>Intensity:</strong> {entry.intensity}/10
          </span>
          {" • "}
          <span>
            <strong>Status:</strong> {capitalize(entry.status)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface IntensityGraphProps {
  data: Array<{ date: Date; intensity: number }>;
}

function IntensityGraph({ data }: IntensityGraphProps) {
  if (data.length === 0) return null;

  const width = 700;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Find min/max dates and intensities
  const dates = data.map((d) => d.date.getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || 1;

  const maxIntensity = 10; // Fixed scale 0-10

  // Map data points to coordinates
  const points = data.map((d) => {
    const x = padding.left + ((d.date.getTime() - minDate) / dateRange) * graphWidth;
    const y = padding.top + graphHeight - (d.intensity / maxIntensity) * graphHeight;
    return { x, y, intensity: d.intensity, date: d.date };
  });

  // Create line path
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg
      width={width}
      height={height}
      style={{ display: "block", margin: "0 auto" }}
      role="img"
      aria-label="Intensity over time graph"
    >
      {/* Y-axis */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={height - padding.bottom}
        stroke="#666"
        strokeWidth={1}
      />
      
      {/* X-axis */}
      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="#666"
        strokeWidth={1}
      />

      {/* Y-axis labels */}
      {[0, 2, 4, 6, 8, 10].map((intensity) => {
        const y = padding.top + graphHeight - (intensity / maxIntensity) * graphHeight;
        return (
          <g key={intensity}>
            <line
              x1={padding.left - 5}
              y1={y}
              x2={padding.left}
              y2={y}
              stroke="#666"
              strokeWidth={1}
            />
            <text
              x={padding.left - 10}
              y={y}
              textAnchor="end"
              alignmentBaseline="middle"
              fontSize={10}
              fill="#666"
            >
              {intensity}
            </text>
          </g>
        );
      })}

      {/* Line graph */}
      <path d={linePath} fill="none" stroke="#2196f3" strokeWidth={2} />

      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="#2196f3">
          <title>{`${formatDate(p.date)}: ${p.intensity}/10`}</title>
        </circle>
      ))}

      {/* Axis labels */}
      <text
        x={padding.left + graphWidth / 2}
        y={height - 5}
        textAnchor="middle"
        fontSize={12}
        fill="#666"
      >
        Date
      </text>
      <text
        x={15}
        y={padding.top + graphHeight / 2}
        textAnchor="middle"
        fontSize={12}
        fill="#666"
        transform={`rotate(-90, 15, ${padding.top + graphHeight / 2})`}
      >
        Intensity
      </text>
    </svg>
  );
}
