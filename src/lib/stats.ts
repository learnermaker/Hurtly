import type { Entry, Quality } from "./types";
import { dayKey } from "./format";

export type Trend = "worse" | "better" | "steady" | "too few";

export const TREND_LABEL: Record<Trend, string> = {
  worse: "Getting worse",
  better: "Easing",
  steady: "Steady",
  "too few": "Too early to tell",
};

export interface RegionSummary {
  regionId: string;
  count: number;
  first: number;
  last: number;
  average: number;
  peak: number;
  latest: number;
  trend: Trend;
  qualities: Quality[];
  triggers: string[];
  relief: string[];
}

export function inRange(entries: Entry[], from: number, to = Infinity): Entry[] {
  return entries.filter((e) => e.createdAt >= from && e.createdAt <= to);
}

function topN<T extends string>(items: T[], n: number): T[] {
  const counts = new Map<T, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Compares the earliest third of readings with the latest third.
 * A change of a full point or more on the 0–10 scale counts as a real shift.
 */
export function trendOf(intensities: number[]): Trend {
  if (intensities.length < 3) return "too few";
  const k = Math.max(1, Math.floor(intensities.length / 3));
  const delta = mean(intensities.slice(-k)) - mean(intensities.slice(0, k));
  if (delta >= 1) return "worse";
  if (delta <= -1) return "better";
  return "steady";
}

export function summarizeRegions(entries: Entry[]): RegionSummary[] {
  const byRegion = new Map<string, Entry[]>();
  for (const e of entries) {
    if (e.kind !== "pain") continue;
    for (const r of e.regions) {
      if (!byRegion.has(r)) byRegion.set(r, []);
      byRegion.get(r)!.push(e);
    }
  }
  const out: RegionSummary[] = [];
  for (const [regionId, list] of byRegion) {
    list.sort((a, b) => a.createdAt - b.createdAt);
    const xs = list.map((e) => e.intensity);
    out.push({
      regionId,
      count: list.length,
      first: list[0].createdAt,
      last: list.at(-1)!.createdAt,
      average: Math.round(mean(xs) * 10) / 10,
      peak: Math.max(...xs),
      latest: xs.at(-1)!,
      trend: trendOf(xs),
      qualities: topN(list.flatMap((e) => e.qualities), 3),
      triggers: topN(list.flatMap((e) => e.triggers), 3),
      relief: topN(list.flatMap((e) => e.relief), 3),
    });
  }
  return out.sort((a, b) => b.last - a.last);
}

/** One point per day: the day's highest intensity for the region. */
export function dailySeries(entries: Entry[], regionId: string): { day: string; t: number; value: number }[] {
  const byDay = new Map<string, { t: number; value: number }>();
  for (const e of entries) {
    if (e.kind !== "pain" || !e.regions.includes(regionId)) continue;
    const k = dayKey(e.createdAt);
    const prev = byDay.get(k);
    if (!prev || e.intensity > prev.value) byDay.set(k, { t: e.createdAt, value: e.intensity });
  }
  return [...byDay.entries()].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.t - b.t);
}

export interface Overview {
  daysLogged: number;
  painFreeDays: number;
  painDays: number;
  entries: number;
}

export function overview(entries: Entry[]): Overview {
  const pain = new Set<string>();
  const clear = new Set<string>();
  for (const e of entries) (e.kind === "pain" ? pain : clear).add(dayKey(e.createdAt));
  const painFree = [...clear].filter((d) => !pain.has(d)).length;
  return {
    daysLogged: new Set([...pain, ...clear]).size,
    painFreeDays: painFree,
    painDays: pain.size,
    entries: entries.length,
  };
}
