/**
 * Painted pain areas, stored as a bitmask over a fine grid laid on the
 * 200×470 figure. Each grid cell inside the body belongs to exactly one
 * area, so the areas an entry covers can always be worked out from the paint.
 */
import { REGIONS, SHAPES, SILHOUETTE, type View } from "../data/regions";
import type { Entry } from "./types";

export const W = 200;
export const H = 470;
export const CELL = 2.5;
export const COLS = W / CELL; // 80
export const ROWS = H / CELL; // 188
const CELLS = COLS * ROWS;

export type Mask = Uint8Array; // one byte per cell: 0 or 1. Packed to bits only when stored.

export interface Arrow {
  view: View;
  from: [number, number];
  to: [number, number];
}

export interface Drawing {
  front?: string;
  back?: string;
  arrows?: Arrow[];
}

export interface Paint {
  front: Mask;
  back: Mask;
  arrows: Arrow[];
}

// ---------- Cell → region map ----------

const REGION_INDEX = new Map(REGIONS.map((r, i) => [r.id, i]));
const cellMaps: Partial<Record<View, Int16Array>> = {};

/** Region index for every cell of a view, or -1 for cells outside the body. */
export function cellRegions(view: View): Int16Array {
  const cached = cellMaps[view];
  if (cached) return cached;
  const zones = SHAPES.filter((s) => s.view === view);
  const map = new Int16Array(CELLS).fill(-1);
  for (let r = 0; r < ROWS; r++) {
    const y = (r + 0.5) * CELL;
    const xs = SILHOUETTE.crossings(y);
    for (let c = 0; c < COLS; c++) {
      const x = (c + 0.5) * CELL;
      // Inside the outline when an odd number of crossings lie to the left.
      let left = 0;
      while (left < xs.length && xs[left] < x) left++;
      if (left % 2 === 0) continue;
      const z = zones.find(({ bbox: [x0, y0, x1, y1], contains }) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && contains(x, y));
      if (z) map[r * COLS + c] = REGION_INDEX.get(z.regionId)!;
    }
  }
  cellMaps[view] = map;
  return map;
}

export function regionAt(view: View, x: number, y: number): string | null {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
  const idx = cellRegions(view)[r * COLS + c];
  return idx === -1 ? null : REGIONS[idx].id;
}

// ---------- Painting ----------

export function emptyMask(): Mask {
  return new Uint8Array(CELLS);
}

export function emptyPaint(): Paint {
  return { front: emptyMask(), back: emptyMask(), arrows: [] };
}

/** Sets (or clears) every body cell within radius r of (x, y). Returns true if anything changed. */
export function brush(mask: Mask, view: View, x: number, y: number, r: number, value: 0 | 1): boolean {
  const map = cellRegions(view);
  const c0 = Math.max(0, Math.floor((x - r) / CELL));
  const c1 = Math.min(COLS - 1, Math.floor((x + r) / CELL));
  const r0 = Math.max(0, Math.floor((y - r) / CELL));
  const r1 = Math.min(ROWS - 1, Math.floor((y + r) / CELL));
  let changed = false;
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const cx = (col + 0.5) * CELL - x;
      const cy = (row + 0.5) * CELL - y;
      if (cx * cx + cy * cy > r * r) continue;
      const i = row * COLS + col;
      if (map[i] === -1 || mask[i] === value) continue;
      mask[i] = value;
      changed = true;
    }
  }
  return changed;
}

/** Brushes along a segment so fast strokes don't leave gaps. */
export function brushLine(mask: Mask, view: View, a: [number, number], b: [number, number], r: number, value: 0 | 1): boolean {
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(dist / (r / 2)));
  let changed = false;
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    changed = brush(mask, view, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r, value) || changed;
  }
  return changed;
}

/**
 * Fills or clears a whole area. A fill is the ellipse that fits the area,
 * so a named area reads as a soft patch rather than a block with the
 * straight edges of its zone.
 */
export function setRegion(mask: Mask, view: View, regionId: string, value: 0 | 1): void {
  const idx = REGION_INDEX.get(regionId);
  if (idx === undefined) return;
  const map = cellRegions(view);
  const fit = value === 1 ? ellipseOf(view, idx) : null;
  for (let i = 0; i < CELLS; i++) {
    if (map[i] !== idx) continue;
    if (fit && ((i % COLS) - fit.cx) ** 2 / fit.rx ** 2 + (Math.floor(i / COLS) - fit.cy) ** 2 / fit.ry ** 2 > 1) continue;
    mask[i] = value;
  }
}

const ellipses = new Map<string, { cx: number; cy: number; rx: number; ry: number }>();

/** The ellipse inscribed in the bounding box of an area's cells, in cell units. */
function ellipseOf(view: View, idx: number) {
  const key = `${view}:${idx}`;
  const hit = ellipses.get(key);
  if (hit) return hit;
  const map = cellRegions(view);
  let [c0, r0, c1, r1] = [COLS, ROWS, -1, -1];
  for (let i = 0; i < CELLS; i++) {
    if (map[i] !== idx) continue;
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    [c0, r0, c1, r1] = [Math.min(c0, c), Math.min(r0, r), Math.max(c1, c), Math.max(r1, r)];
  }
  const fit = { cx: (c0 + c1) / 2, cy: (r0 + r1) / 2, rx: (c1 - c0) / 2 + 0.5, ry: (r1 - r0) / 2 + 0.5 };
  ellipses.set(key, fit);
  return fit;
}

export function paintFromRegions(regions: string[]): Paint {
  const p = emptyPaint();
  for (const id of regions) {
    setRegion(p.front, "front", id, 1);
    setRegion(p.back, "back", id, 1);
  }
  return p;
}

export function clearRegion(p: Paint, regionId: string): void {
  setRegion(p.front, "front", regionId, 0);
  setRegion(p.back, "back", regionId, 0);
}

const regionSizes: Partial<Record<View, number[]>> = {};

function sizes(view: View): number[] {
  const cached = regionSizes[view];
  if (cached) return cached;
  const out = new Array(REGIONS.length).fill(0);
  for (const idx of cellRegions(view)) if (idx !== -1) out[idx]++;
  regionSizes[view] = out;
  return out;
}

/**
 * Regions with a meaningful share painted. A stroke that grazes a neighbour
 * shouldn't add it, so we need a few cells and ~8% of the region.
 */
export function regionsInMask(mask: Mask, view: View): string[] {
  const map = cellRegions(view);
  const counts = new Array(REGIONS.length).fill(0);
  for (let i = 0; i < CELLS; i++) if (mask[i] && map[i] !== -1) counts[map[i]]++;
  const total = sizes(view);
  return REGIONS.filter((_, i) => counts[i] >= Math.max(3, total[i] * 0.08)).map((r) => r.id);
}

export function regionsInPaint(p: Paint): string[] {
  const ids = new Set([...regionsInMask(p.front, "front"), ...regionsInMask(p.back, "back")]);
  // Keep the canonical region order so labels read head-to-toe.
  return REGIONS.map((r) => r.id).filter((id) => ids.has(id));
}

export function mergePaint(a: Paint, b: Paint): Paint {
  const out = clonePaint(a);
  for (let i = 0; i < CELLS; i++) {
    out.front[i] |= b.front[i];
    out.back[i] |= b.back[i];
  }
  out.arrows.push(...b.arrows);
  return out;
}

export function clonePaint(p: Paint): Paint {
  return { front: p.front.slice(), back: p.back.slice(), arrows: p.arrows.map((a) => ({ ...a })) };
}

// ---------- Storage ----------

export function encodeMask(mask: Mask): string | undefined {
  if (!mask.some(Boolean)) return undefined;
  const bytes = new Uint8Array(Math.ceil(CELLS / 8));
  for (let i = 0; i < CELLS; i++) if (mask[i]) bytes[i >> 3] |= 1 << (i & 7);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeMask(s: string | undefined): Mask {
  const mask = emptyMask();
  if (!s) return mask;
  const bin = atob(s);
  for (let i = 0; i < CELLS; i++) if (bin.charCodeAt(i >> 3) & (1 << (i & 7))) mask[i] = 1;
  return mask;
}

export function toDrawing(p: Paint): Drawing | undefined {
  const d: Drawing = { front: encodeMask(p.front), back: encodeMask(p.back), arrows: p.arrows.length ? p.arrows : undefined };
  return d.front || d.back || d.arrows ? d : undefined;
}

export function fromDrawing(d: Drawing | undefined): Paint {
  return { front: decodeMask(d?.front), back: decodeMask(d?.back), arrows: d?.arrows ?? [] };
}

const entryPaintCache = new Map<string, Paint>();

/** The paint for an entry: its own drawing, or its regions filled in for entries logged without one. */
export function paintOf(e: Pick<Entry, "id" | "regions" | "drawing">): Paint {
  const hit = entryPaintCache.get(e.id);
  if (hit) return hit;
  const p = e.drawing ? fromDrawing(e.drawing) : paintFromRegions(e.regions);
  entryPaintCache.set(e.id, p);
  return p;
}

// ---------- History heat ----------

/** Per cell: highest intensity painted (0–10), or -1 where nothing was painted. */
export function heatCells(entries: Entry[], view: View): Int8Array {
  const out = new Int8Array(CELLS).fill(-1);
  for (const e of entries) {
    if (e.kind !== "pain") continue;
    const m = paintOf(e)[view];
    for (let i = 0; i < CELLS; i++) if (m[i] && e.intensity > out[i]) out[i] = e.intensity;
  }
  return out;
}
