import { useSyncExternalStore } from "react";

/** Where AI features run: the browser's built-in model, Gemini with the user's key, or nowhere. */
export type AiMode = "off" | "device" | "gemini";

export interface Settings {
  aiMode: AiMode;
  geminiKey: string;
  model: string;
}

/** Alias that Google keeps pointed at the current Flash model. */
export const DEFAULT_MODEL = "gemini-flash-latest";

// Storage keys keep the app's original name so existing entries and settings survive the rename.
const KEY = "bodytrace.settings";
const DEFAULTS: Settings = { aiMode: "off", geminiKey: "", model: DEFAULT_MODEL };

let cache: Settings = load();
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const { aiEnabled, ...saved } = JSON.parse(raw);
    // Settings saved before on-device AI had an on/off flag for Gemini instead of a mode.
    if (!saved.aiMode) saved.aiMode = aiEnabled && saved.geminiKey ? "gemini" : "off";
    return { ...DEFAULTS, ...saved };
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
  return s.aiMode === "device" || (s.aiMode === "gemini" && s.geminiKey.trim().length > 0);
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
