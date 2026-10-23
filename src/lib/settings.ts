import { useSyncExternalStore } from "react";

export interface Settings {
  aiEnabled: boolean;
  geminiKey: string;
  model: string;
}

/** Alias that Google keeps pointed at the current Flash model. */
export const DEFAULT_MODEL = "gemini-flash-latest";

const KEY = "bodytrace.settings";
const DEFAULTS: Settings = { aiEnabled: false, geminiKey: "", model: DEFAULT_MODEL };

let cache: Settings = load();
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function getSettings(): Settings {
  return cache;
}

export function updateSettings(patch: Partial<Settings>): void {
  cache = { ...cache, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage blocked (private mode): keep the in-memory copy for this visit.
  }
  listeners.forEach((l) => l());
}

export function aiReady(s: Settings = cache): boolean {
  return s.aiEnabled && s.geminiKey.trim().length > 0;
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache,
  );
}
