/**
 * BodyRendererSwitcher
 *
 * Lets the user choose between three body model rendering modes:
 *   1. "3d-basic"  — current Three.js procedural model
 *   2. "svg"       — react-body-highlighter labeled SVG diagram
 *   3. "3d-atlas"  — placeholder for future Z-Anatomy/BodyParts3D glTF model
 *
 * The selected mode is persisted to localStorage so it survives page reloads.
 */

import { useState } from "react";
import type { PainMarker, AnatomicalLocation, AnatomicalBoundary } from "@bodytrace/shared";
import BodyModelRenderer from "./BodyModelRenderer";
import SVGBodyRenderer from "./SVGBodyRenderer";

export type BodyRendererMode = "3d-basic" | "svg" | "3d-atlas";

const MODE_KEY = "bodytrace_renderer_mode";

function getSavedMode(): BodyRendererMode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (saved === "3d-basic" || saved === "svg" || saved === "3d-atlas") return saved;
  } catch {
    // ignore
  }
  return "3d-basic";
}

const MODES: { id: BodyRendererMode; label: string; description: string; available: boolean }[] = [
  {
    id: "3d-basic",
    label: "3D Basic",
    description: "Procedural Three.js model — rotate & zoom",
    available: true,
  },
  {
    id: "svg",
    label: "SVG Diagram",
    description: "Labeled muscle regions — fast & mobile-friendly",
    available: true,
  },
  {
    id: "3d-atlas",
    label: "3D Atlas",
    description: "Anatomically accurate Z-Anatomy model (coming soon)",
    available: false,
  },
];

export interface BodyRendererSwitcherProps {
  markers?: PainMarker[];
  onPointSelect?: (location: AnatomicalLocation) => void;
  onAreaTrace?: (boundary: AnatomicalBoundary) => void;
  enableKeyboardNavigation?: boolean;
}

export default function BodyRendererSwitcher({
  markers = [],
  onPointSelect,
  onAreaTrace,
  enableKeyboardNavigation = true,
}: BodyRendererSwitcherProps) {
  const [mode, setMode] = useState<BodyRendererMode>(getSavedMode);

  const handleModeChange = (newMode: BodyRendererMode) => {
    setMode(newMode);
    try {
      localStorage.setItem(MODE_KEY, newMode);
    } catch {
      // ignore
    }
  };

  return (
    <div>
      {/* Mode selector */}
      <div style={{
        display: "flex",
        gap: 8,
        marginBottom: 16,
        padding: "10px 12px",
        backgroundColor: "#f5f5f5",
        borderRadius: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <span style={{ fontSize: 12, color: "#666", fontWeight: 500, marginRight: 4 }}>
          Body Model:
        </span>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => m.available && handleModeChange(m.id)}
            disabled={!m.available}
            title={m.description}
            aria-pressed={mode === m.id}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              borderRadius: 4,
              border: `1px solid ${mode === m.id ? "#1565c0" : "#ccc"}`,
              backgroundColor: mode === m.id ? "#1565c0" : m.available ? "#fff" : "#f0f0f0",
              color: mode === m.id ? "#fff" : m.available ? "#333" : "#aaa",
              cursor: m.available ? "pointer" : "not-allowed",
              fontWeight: mode === m.id ? 600 : 400,
              position: "relative",
            }}
          >
            {m.label}
            {!m.available && (
              <span style={{
                marginLeft: 6,
                fontSize: 10,
                backgroundColor: "#e0e0e0",
                color: "#888",
                padding: "1px 5px",
                borderRadius: 8,
              }}>
                soon
              </span>
            )}
          </button>
        ))}
        <span style={{ fontSize: 11, color: "#999", marginLeft: 4 }}>
          {MODES.find((m) => m.id === mode)?.description}
        </span>
      </div>

      {/* Renderer */}
      {mode === "3d-basic" && (
        <div style={{ minHeight: 400 }}>
          <BodyModelRenderer
            markers={markers}
            onPointSelect={onPointSelect}
            onAreaTrace={onAreaTrace}
            enableKeyboardNavigation={enableKeyboardNavigation}
          />
        </div>
      )}

      {mode === "svg" && (
        <SVGBodyRenderer
          markers={markers}
          onPointSelect={onPointSelect}
        />
      )}

      {mode === "3d-atlas" && (
        <div style={{
          minHeight: 400,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f9f9f9",
          borderRadius: 8,
          border: "2px dashed #e0e0e0",
          color: "#999",
          gap: 12,
        }}>
          <div style={{ fontSize: 48 }}>🧬</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#666" }}>3D Atlas — Coming Soon</div>
          <div style={{ fontSize: 13, textAlign: "center", maxWidth: 320, color: "#999" }}>
            Anatomically accurate model based on Z-Anatomy / BodyParts3D (CC BY-SA).
            800+ labeled regions, medically precise.
          </div>
        </div>
      )}
    </div>
  );
}
