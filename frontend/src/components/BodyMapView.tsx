import { useState, useMemo, useCallback } from "react";
import type {
  PainMarker,
  PainType,
  SymptomDescriptor,
  MarkerFilter,
} from "@bodytrace/shared";
import BodyModelRenderer from "./BodyModelRenderer";
import { getAllRegions } from "../services/anatomical-region-mapper";

const PAIN_TYPES: PainType[] = [
  "sharp", "dull", "burning", "throbbing",
  "aching", "stabbing", "tingling", "numbness",
];

export interface BodyMapViewProps {
  markers: PainMarker[];
  descriptors: SymptomDescriptor[];
  onFilterChange?: (filters: MarkerFilter) => void;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toDateInputValue(date: Date | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

export default function BodyMapView({
  markers,
  descriptors,
  onFilterChange,
}: BodyMapViewProps) {
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [filters, setFilters] = useState<MarkerFilter>({});

  const allRegions = useMemo(() => getAllRegions(), []);

  // Apply filters to markers
  const filteredMarkers = useMemo(() => {
    return markers.filter((m) => {
      if (filters.dateRange) {
        const created = new Date(m.createdAt).getTime();
        if (created < new Date(filters.dateRange.start).getTime()) return false;
        if (created > new Date(filters.dateRange.end).getTime()) return false;
      }
      if (filters.intensityRange) {
        if (m.intensity < filters.intensityRange.min) return false;
        if (m.intensity > filters.intensityRange.max) return false;
      }
      if (filters.painTypes && filters.painTypes.length > 0) {
        const desc = descriptors.find((d) => d.markerId === m.id);
        if (!desc || !filters.painTypes.includes(desc.painType)) return false;
      }
      if (filters.regions && filters.regions.length > 0) {
        if (!filters.regions.includes(m.location.region.id)) return false;
      }
      return true;
    });
  }, [markers, descriptors, filters]);

  const selectedMarker = useMemo(
    () => filteredMarkers.find((m) => m.id === selectedMarkerId) ?? null,
    [filteredMarkers, selectedMarkerId]
  );

  const selectedDescriptor = useMemo(
    () =>
      selectedMarker
        ? descriptors.find((d) => d.markerId === selectedMarker.id) ?? null
        : null,
    [selectedMarker, descriptors]
  );

  const updateFilters = useCallback(
    (patch: Partial<MarkerFilter>) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch };
        onFilterChange?.(next);
        return next;
      });
    },
    [onFilterChange]
  );

  const handlePainTypeToggle = useCallback(
    (type: PainType) => {
      setFilters((prev) => {
        const current = prev.painTypes ?? [];
        const next = current.includes(type)
          ? current.filter((t) => t !== type)
          : [...current, type];
        const updated = { ...prev, painTypes: next.length > 0 ? next : undefined };
        onFilterChange?.(updated);
        return updated;
      });
    },
    [onFilterChange]
  );

  const handleRegionChange = useCallback(
    (regionId: string) => {
      updateFilters({
        regions: regionId ? [regionId] : undefined,
      });
    },
    [updateFilters]
  );

  const handleMarkerClick = useCallback((markerId: string) => {
    setSelectedMarkerId((prev) => (prev === markerId ? null : markerId));
  }, []);

  return (
    <div
      style={{ display: "flex", gap: 16, fontFamily: "system-ui, sans-serif", color: "#222" }}
      aria-label="Body Map View"
      role="region"
    >
      {/* Left: 3D Model */}
      <div style={{ flex: 1, minHeight: 500, position: "relative" }}>
        <BodyModelRenderer
          markers={filteredMarkers}
          showBodyMap={true}
        />
        {/* Clickable marker list overlay for selection */}
        <div
          role="list"
          aria-label="Pain markers on body map"
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            right: 8,
            maxHeight: 120,
            overflowY: "auto",
            background: "rgba(255,255,255,0.92)",
            borderRadius: 6,
            padding: 6,
            fontSize: 12,
          }}
        >
          {filteredMarkers.length === 0 && (
            <div style={{ padding: 4, color: "#888" }}>No markers match the current filters.</div>
          )}
          {filteredMarkers.map((m) => (
            <button
              key={m.id}
              role="listitem"
              onClick={() => handleMarkerClick(m.id)}
              aria-label={`Select marker at ${m.location.region.name}, intensity ${m.intensity}, status ${m.status}`}
              aria-pressed={selectedMarkerId === m.id}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                marginBottom: 2,
                border: selectedMarkerId === m.id ? "2px solid #1565c0" : "1px solid #666",
                borderRadius: 4,
                background: selectedMarkerId === m.id ? "#e3f2fd" : "transparent",
                cursor: "pointer",
                fontSize: 12,
                minHeight: "44px", // WCAG touch target size
                color: "#222", // Ensure text contrast
              }}
            >
              {m.location.region.name} — Intensity {m.intensity} — {capitalize(m.status)}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Filters + Detail Panel */}
      <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Filter Controls */}
        <fieldset
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, margin: 0 }}
          aria-label="Filter pain markers"
        >
          <legend style={{ fontWeight: 600, fontSize: 14, padding: "0 4px" }}>Filters</legend>

          {/* Date Range */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              Date Range
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="date"
                aria-label="Filter start date"
                value={toDateInputValue(filters.dateRange?.start)}
                onChange={(e) => {
                  const val = e.target.value;
                  updateFilters({
                    dateRange: val
                      ? {
                          start: new Date(val),
                          end: filters.dateRange?.end ?? new Date(),
                        }
                      : undefined,
                  });
                }}
                style={{ 
                  flex: 1, 
                  padding: "10px 8px", 
                  fontSize: 12, 
                  border: "1px solid #666", 
                  borderRadius: 4,
                  minHeight: "44px", // WCAG touch target size
                }}
              />
              <span style={{ fontSize: 12 }} aria-hidden="true">to</span>
              <input
                type="date"
                aria-label="Filter end date"
                value={toDateInputValue(filters.dateRange?.end)}
                onChange={(e) => {
                  const val = e.target.value;
                  updateFilters({
                    dateRange: val
                      ? {
                          start: filters.dateRange?.start ?? new Date(0),
                          end: new Date(val),
                        }
                      : undefined,
                  });
                }}
                style={{ 
                  flex: 1, 
                  padding: "10px 8px", 
                  fontSize: 12, 
                  border: "1px solid #666", 
                  borderRadius: 4,
                  minHeight: "44px", // WCAG touch target size
                }}
              />
            </div>
          </div>

          {/* Pain Type Checkboxes */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              Pain Type
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Pain type filter">
              {PAIN_TYPES.map((type) => (
                <label
                  key={type}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    fontSize: 12,
                    cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: 4,
                    border: (filters.painTypes ?? []).includes(type)
                      ? "2px solid #1565c0"
                      : "1px solid #666",
                    background: (filters.painTypes ?? []).includes(type) ? "#e3f2fd" : "transparent",
                    minHeight: "44px", // WCAG touch target size
                    color: "#222", // Ensure text contrast
                  }}
                >
                  <input
                    type="checkbox"
                    checked={(filters.painTypes ?? []).includes(type)}
                    onChange={() => handlePainTypeToggle(type)}
                    aria-label={`Filter by pain type: ${capitalize(type)}`}
                    style={{ margin: 0 }}
                  />
                  {capitalize(type)}
                </label>
              ))}
            </div>
          </div>

          {/* Intensity Range */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              Intensity Range: {filters.intensityRange?.min ?? 0} – {filters.intensityRange?.max ?? 10}
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11 }}>Min</span>
              <input
                type="range"
                min={0}
                max={10}
                value={filters.intensityRange?.min ?? 0}
                onChange={(e) =>
                  updateFilters({
                    intensityRange: {
                      min: Number(e.target.value),
                      max: filters.intensityRange?.max ?? 10,
                    },
                  })
                }
                aria-label="Minimum intensity filter"
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={filters.intensityRange?.min ?? 0}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 11 }}>Max</span>
              <input
                type="range"
                min={0}
                max={10}
                value={filters.intensityRange?.max ?? 10}
                onChange={(e) =>
                  updateFilters({
                    intensityRange: {
                      min: filters.intensityRange?.min ?? 0,
                      max: Number(e.target.value),
                    },
                  })
                }
                aria-label="Maximum intensity filter"
                aria-valuemin={0}
                aria-valuemax={10}
                aria-valuenow={filters.intensityRange?.max ?? 10}
                style={{ flex: 1 }}
              />
            </div>
          </div>

          {/* Region Dropdown */}
          <div>
            <label
              htmlFor="region-filter"
              style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 4 }}
            >
              Anatomical Region
            </label>
            <select
              id="region-filter"
              value={filters.regions?.[0] ?? ""}
              onChange={(e) => handleRegionChange(e.target.value)}
              aria-label="Filter by anatomical region"
              style={{
                width: "100%",
                padding: "10px 12px",
                fontSize: 12,
                border: "1px solid #666",
                borderRadius: 4,
                minHeight: "44px", // WCAG touch target size
                color: "#222", // Ensure text contrast
              }}
            >
              <option value="">All Regions</option>
              {allRegions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        {/* Detail Panel */}
        {selectedMarker && (
          <div
            role="region"
            aria-label={`Detail panel for marker at ${selectedMarker.location.region.name}`}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>
              {selectedMarker.location.region.name}
            </h3>
            <div style={{ fontSize: 13, marginBottom: 4 }}>
              <strong>Status:</strong> {capitalize(selectedMarker.status)}
            </div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>
              <strong>Intensity:</strong> {selectedMarker.intensity}/10
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>Date:</strong> {formatDate(selectedMarker.createdAt)}
            </div>

            {selectedDescriptor && (
              <>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Pain Type:</strong> {capitalize(selectedDescriptor.painType)}
                </div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Frequency:</strong> {capitalize(selectedDescriptor.frequency)}
                </div>
                <div style={{ fontSize: 13, marginBottom: 8 }}>
                  <strong>Duration:</strong> {capitalize(selectedDescriptor.duration)}
                </div>

                {selectedDescriptor.followUpResponses.length > 0 && (
                  <div>
                    <strong style={{ fontSize: 13 }}>Follow-Up Responses:</strong>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12 }}>
                      {selectedDescriptor.followUpResponses.map((r) => (
                        <li key={r.questionId} style={{ marginBottom: 4 }}>
                          <em>{r.questionText}</em>
                          <br />
                          {r.response}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
