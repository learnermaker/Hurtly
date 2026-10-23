import type { Drawing } from "./mask";

export const QUALITIES = [
  "aching",
  "sharp",
  "dull",
  "burning",
  "throbbing",
  "stabbing",
  "shooting",
  "tingling",
  "numb",
  "stiff",
  "cramping",
  "tender",
] as const;
export type Quality = (typeof QUALITIES)[number];

export const PATTERNS = ["constant", "comes and goes", "only when moving", "just once"] as const;
export type Pattern = (typeof PATTERNS)[number];

export const TRIGGER_SUGGESTIONS = [
  "sitting",
  "standing",
  "walking",
  "bending",
  "lifting",
  "exercise",
  "stress",
  "poor sleep",
  "screen time",
  "weather",
  "eating",
];

export const RELIEF_SUGGESTIONS = [
  "rest",
  "heat",
  "ice",
  "stretching",
  "moving around",
  "painkillers",
  "massage",
  "sleep",
];

export const IMPACT_OPTIONS = ["sleep", "work", "walking", "exercise", "chores", "mood"];

export interface FollowUp {
  question: string;
  answer: string;
}

export interface Entry {
  id: string;
  /** Epoch milliseconds. */
  createdAt: number;
  /** "clear" is a pain-free check-in, so gaps in the log aren't mistaken for good days. */
  kind: "pain" | "clear";
  regions: string[];
  /** Where it was painted on the figure. Older entries have only regions. */
  drawing?: Drawing;
  /** 0–10. */
  intensity: number;
  qualities: Quality[];
  pattern?: Pattern;
  triggers: string[];
  relief: string[];
  impact: string[];
  note?: string;
  followUps: FollowUp[];
  source: "tap" | "describe" | "repeat";
}

/** The details being filled in for a new entry. Where it hurts lives in the paint, not here. */
export type Draft = Omit<Entry, "id" | "createdAt" | "kind" | "followUps" | "regions" | "drawing">;

export function emptyDraft(): Draft {
  return {
    intensity: 4,
    qualities: [],
    triggers: [],
    relief: [],
    impact: [],
    source: "tap",
  };
}

export function draftFrom(e: Entry): Draft {
  const { intensity, qualities, pattern, triggers, relief, impact } = e;
  return { intensity, qualities, pattern, triggers, relief, impact, source: "repeat" };
}

export function intensityWord(n: number): string {
  if (n === 0) return "No pain";
  if (n <= 3) return "Mild";
  if (n <= 6) return "Moderate";
  if (n <= 9) return "Severe";
  return "Worst imaginable";
}
