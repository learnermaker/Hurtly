import type { Entry } from "../lib/types";

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: crypto.randomUUID(),
    createdAt: 0,
    kind: "pain",
    regions: [],
    intensity: 5,
    qualities: [],
    triggers: [],
    relief: [],
    impact: [],
    followUps: [],
    source: "tap",
    ...overrides,
  };
}
