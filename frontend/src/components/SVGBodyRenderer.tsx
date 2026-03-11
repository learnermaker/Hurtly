/**
 * SVGBodyRenderer
 *
 * Uses react-body-highlighter (MIT) to render a labeled, clickable
 * front/back SVG body diagram. Muscle regions are highlighted by
 * pain intensity using the same color scale as BodyModelRenderer.
 *
 * Supported regions map to AnatomicalRegion IDs via SVG_REGION_MAP.
 */

import { useState } from "react";
import Model, { type IExerciseData } from "react-body-highlighter";
import type { PainMarker, AnatomicalLocation } from "@bodytrace/shared";
import { intensityToColor } from "./BodyModelRenderer";
import { getAllRegions } from "../services/anatomical-region-mapper";

// Map react-body-highlighter muscle names → AnatomicalRegion IDs
const SVG_TO_REGION_ID: Record<string, string> = {
  head: "head",
  neck: "neck",
  chest: "chest",
  "upper-back": "upper-back",
  "lower-back": "lower-back",
  abs: "abdomen",
  obliques: "abdomen",
  trapezius: "neck",
  "front-deltoids": "right-shoulder",
  "back-deltoids": "upper-back",
  biceps: "right-upper-arm",
  triceps: "right-upper-arm",
  forearm: "right-forearm",
  gluteal: "right-hip",
  quadriceps: "right-thigh",
  hamstring: "right-thigh",
  adductor: "right-thigh",
  abductors: "right-thigh",
  calves: "right-shin",
};

// Reverse map: region ID → muscle name(s) for highlighting
const REGION_TO_MUSCLES: Record<string, string[]> = {
  head: ["head"],
  neck: ["neck", "trapezius"],
  chest: ["chest"],
  "upper-back": ["upper-back", "back-deltoids"],
  "lower-back": ["lower-back"],
  abdomen: ["abs", "obliques"],
  "left-shoulder": ["front-deltoids"],
  "right-shoulder": ["front-deltoids"],
  "left-upper-arm": ["biceps", "triceps"],
  "right-upper-arm": ["biceps", "triceps"],
  "left-forearm": ["forearm"],
  "right-forearm": ["forearm"],
  "left-thigh": ["quadriceps", "hamstring", "adductor", "abductors"],
  "right-thigh": ["quadriceps", "hamstring", "adductor", "abductors"],
  "left-shin": ["calves"],
  "right-shin": ["calves"],
  "left-hip": ["gluteal"],
  "right-hip": ["gluteal"],
};

export interface SVGBodyRendererProps {
  markers?: PainMarker[];
  onPointSelect?: (location: AnatomicalLocation) => void;
}

export default function SVGBodyRenderer({
  markers = [],
  onPointSelect,
}: SVGBodyRendererProps) {
  const [view, setView] = useState<"anterior" | "posterior">("anterior");
  const allRegions = getAllRegions();

  // Build highlight data from markers — group by muscle, pick max intensity
  const muscleIntensity: Record<string, number> = {};
  for (const marker of markers) {
    const muscles = REGION_TO_MUSCLES[marker.location.region.id] ?? [];
    for (const muscle of muscles) {
      muscleIntensity[muscle] = Math.max(muscleIntensity[muscle] ?? 0, marker.intensity);
    }
  }

  // react-body-highlighter expects: { name, muscles, frequency? }
  // We use frequency 1-3 to drive the color tiers (low/mid/high intensity)
  const highlightData: IExerciseData[] = Object.entries(muscleIntensity).map(([muscle, intensity]) => ({
    name: muscle,
    muscles: [muscle] as IExerciseData["muscles"],
    frequency: intensity >= 7 ? 3 : intensity >= 4 ? 2 : 1,
  }));

  const handleMuscleClick = ({ muscle }: { muscle: string }) => {
    if (!onPointSelect) return;

    const regionId = SVG_TO_REGION_ID[muscle];
    if (!regionId) return;

    const region = allRegions.find((r) => r.id === regionId) ?? {
      id: regionId,
      name: muscle.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      bodySystem: "musculoskeletal",
    };

    // SVG model has no 3D coords — use (0,0,0) as placeholder
    const location: AnatomicalLocation = {
      region,
      coordinates: { x: 0, y: 0, z: 0 },
    };

    onPointSelect(location);
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Front / Back toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["anterior", "posterior"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: "6px 16px",
              fontSize: 13,
              borderRadius: 4,
              border: "1px solid #1565c0",
              backgroundColor: view === v ? "#1565c0" : "#fff",
              color: view === v ? "#fff" : "#1565c0",
              cursor: "pointer",
              fontWeight: view === v ? 600 : 400,
            }}
          >
            {v === "anterior" ? "Front" : "Back"}
          </button>
        ))}
      </div>

      {/* Body diagram */}
      <div
        role="application"
        aria-label="SVG body diagram — click a muscle region to mark pain"
        style={{ display: "flex", justifyContent: "center" }}
      >
        <Model
          data={highlightData}
          highlightedColors={["#4caf50", "#ff9800", "#f44336"]}
          onClick={handleMuscleClick}
          type={view}
          style={{ width: "260px", padding: "1rem" }}
        />
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12, fontSize: 12, color: "#666" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#4caf50", display: "inline-block" }} />
          Low (1–3)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#ff9800", display: "inline-block" }} />
          Moderate (4–6)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#f44336", display: "inline-block" }} />
          High (7–10)
        </span>
      </div>

      <p style={{ textAlign: "center", fontSize: 12, color: "#999", marginTop: 8 }}>
        Click a region to mark pain • Toggle Front/Back to see all areas
      </p>
    </div>
  );
}
