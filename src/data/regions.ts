/**
 * The body figure and its areas, on a 200×470 front/back canvas.
 *
 * The figure is one smooth outline (the same for both views). Areas are
 * invisible zones laid over it: a point belongs to the first zone that
 * contains it, and only points inside the outline can be painted.
 *
 * Front view: the person faces you, so their RIGHT side is on the viewer's left.
 * Back view: you see their back, so their LEFT side is on the viewer's left.
 * Paired zones are defined once for the viewer's left and mirrored.
 */

export type View = "front" | "back";
export type Side = "left" | "right" | "center";
export type Group = "head" | "neck" | "shoulder" | "arm" | "chest" | "abdomen" | "back" | "pelvis" | "leg" | "foot";

export interface Region {
  id: string;
  label: string;
  side: Side;
  group: Group;
}

export interface Shape {
  regionId: string;
  view: View;
  d: string;
  contains: (x: number, y: number) => boolean;
  /** [minX, minY, maxX, maxY], for cheap rejection before contains(). */
  bbox: [number, number, number, number];
}

type Pt = [number, number];

const W = 200;

// ---------- Geometry helpers ----------

function poly(points: Pt[]): string {
  return "M" + points.map(([x, y]) => `${x} ${y}`).join(" L") + " Z";
}

function mirror(points: Pt[]): Pt[] {
  return points.map(([x, y]) => [W - x, y] as Pt);
}

function rect(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

function polygonContains(pts: Pt[]): (x: number, y: number) => boolean {
  // Even-odd ray casting.
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

function bboxOf(pts: Pt[]): Shape["bbox"] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * A closed Catmull–Rom curve through the points, as an SVG path plus a
 * finely sampled polygon of the same curve for hit-testing.
 */
function smoothClosed(points: Pt[], samples = 8): { d: string; polygon: Pt[] } {
  const n = points.length;
  const at = (i: number) => points[(i + n) % n];
  let d = `M${at(0)[0]} ${at(0)[1]}`;
  const polygon: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
    for (let s = 0; s < samples; s++) {
      const t = s / samples;
      const u = 1 - t;
      const b = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      polygon.push([
        b[0] * p1[0] + b[1] * c1[0] + b[2] * c2[0] + b[3] * p2[0],
        b[0] * p1[1] + b[1] * c1[1] + b[2] * c2[1] + b[3] * p2[1],
      ]);
    }
  }
  return { d: d + " Z", polygon };
}

// ---------- The figure ----------

/** Outline of the viewer-left half, from the crown down the outside and back up the inner leg. */
const HALF_OUTLINE: Pt[] = [
  // Head
  [100, 10], [88, 13], [80, 24], [78, 38], [80, 52], [85, 62], [92, 69],
  // Neck and the slope of the shoulder
  [90, 76], [89, 84], [78, 88], [64, 92],
  // Shoulder and outer arm, held slightly away from the body
  [54, 99], [50, 112], [48, 135], [45, 160], [42, 182],
  [37, 206], [32, 230], [29, 246],
  // Hand
  [25, 258], [22, 272], [24, 286], [30, 292], [36, 288], [39, 276], [41, 260],
  // Inner arm back up to the armpit
  [44, 248], [47, 228], [52, 206], [56, 185], [60, 160], [64, 140], [68, 127],
  // Side of the torso
  [71, 142], [74, 165], [75, 185], [73, 205], [70, 222], [68, 242],
  // Outer leg
  [68, 262], [70, 292], [73, 322], [76, 345], [76, 362],
  [75, 378], [76, 398], [79, 420], [82, 436],
  // Foot
  [80, 446], [75, 455], [79, 461], [95, 461], [97, 450], [96, 437],
  // Inner leg back up to the crotch
  [95, 428], [95, 405], [96, 380], [97, 356], [97, 338], [98, 310], [99, 284],
];

const OUTLINE = smoothClosed([...HALF_OUTLINE, [100, 264], ...mirror(HALF_OUTLINE).reverse().slice(0, -1)]);

export const SILHOUETTE = {
  d: OUTLINE.d,
  /** Sorted x positions where the outline crosses the line at height y; inside lies between pairs. */
  crossings(y: number): number[] {
    const pts = OUTLINE.polygon;
    const xs: number[] = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
    return xs.sort((a, b) => a - b);
  },
};

/** Quiet anatomical landmarks drawn over the figure, as SVG paths. */
function both(d: (m: (x: number) => number) => string): string[] {
  return [d((x) => x), d((x) => W - x)];
}

export const LANDMARKS: Record<View, string[]> = {
  front: [
    ...both((m) => `M${m(80)} 93 Q${m(90)} 97 ${m(98)} 95`), // collarbones
    ...both((m) => `M${m(78)} 128 Q${m(88)} 135 ${m(97)} 131`), // chest
    "M100 189 m-1.6 0 a1.6 2 0 1 0 3.2 0 a1.6 2 0 1 0 -3.2 0", // navel
    ...both((m) => `M${m(83)} 238 Q${m(91)} 251 ${m(97)} 258`), // groin crease
    ...both((m) => `M${m(82)} 352 Q${m(87)} 357 ${m(92)} 352`), // kneecaps
  ],
  back: [
    "M100 90 L100 228", // spine
    ...both((m) => `M${m(80)} 103 Q${m(84)} 122 ${m(95)} 126`), // shoulder blades
    ...both((m) => `M${m(74)} 258 Q${m(86)} 268 ${m(99)} 263`), // gluteal folds
    ...both((m) => `M${m(80)} 352 Q${m(87)} 356 ${m(94)} 352`), // backs of knees
    ...both((m) => `M${m(91)} 66 Q${m(95)} 71 ${m(100)} 72`), // hairline
  ],
};

// ---------- Areas ----------

export const REGIONS: Region[] = [];
export const SHAPES: Shape[] = [];

function addRegion(region: Region) {
  if (!REGIONS.some((r) => r.id === region.id)) REGIONS.push(region);
}

function zone(regionId: string, view: View, pts: Pt[]) {
  SHAPES.push({ regionId, view, d: poly(pts), contains: polygonContains(pts), bbox: bboxOf(pts) });
}

function center(id: string, label: string, group: Group, views: View[], pts: Pt[]) {
  addRegion({ id, label, side: "center", group });
  for (const view of views) zone(id, view, pts);
}

/** Adds the left and right versions of an area on the given views. */
function paired(base: string, label: string, group: Group, views: View[], viewerLeft: Pt[]) {
  for (const side of ["right", "left"] as const) {
    const id = `${base}-${side === "right" ? "r" : "l"}`;
    addRegion({ id, label: `${side === "right" ? "Right" : "Left"} ${label}`, side, group });
    for (const view of views) {
      const onViewerLeft = (view === "front") === (side === "right");
      zone(id, view, onViewerLeft ? viewerLeft : mirror(viewerLeft));
    }
  }
}

const BOTH: View[] = ["front", "back"];
const FRONT: View[] = ["front"];
const BACK: View[] = ["back"];

// Zones are listed in priority order: where they overlap, the earlier one wins.
center("head", "Head / face", "head", FRONT, rect(0, 0, 200, 68));
center("head-back", "Back of head", "head", BACK, rect(0, 0, 200, 68));
center("neck-front", "Front of neck", "neck", FRONT, rect(78, 68, 122, 92));
center("neck-back", "Back of neck", "neck", BACK, rect(78, 68, 122, 92));

const UPPER_TORSO: Pt[] = [[76, 86], [100, 86], [100, 141], [66, 141], [66, 126], [76, 112]];
paired("chest", "chest", "chest", FRONT, UPPER_TORSO);
paired("upper-back", "upper back", "back", BACK, UPPER_TORSO);
paired("shoulder", "shoulder", "shoulder", BOTH, [[20, 82], [80, 82], [76, 112], [66, 126], [20, 126]]);

paired("upper-arm", "upper arm", "arm", BOTH, [[10, 120], [70, 120], [64, 183], [10, 183]]);
paired("elbow", "elbow", "arm", BOTH, [[10, 183], [64, 183], [61, 201], [10, 201]]);
paired("forearm", "forearm", "arm", BOTH, [[0, 201], [61, 201], [50, 249], [0, 249]]);
paired("hand", "wrist / hand", "arm", BOTH, rect(0, 249, 50, 300));

center("upper-abdomen", "Upper abdomen", "abdomen", FRONT, rect(60, 141, 140, 186));
center("lower-abdomen", "Lower abdomen", "abdomen", FRONT, rect(60, 186, 140, 222));
center("groin", "Groin / pelvis", "pelvis", FRONT, [[86, 222], [114, 222], [108, 268], [100, 272], [92, 268]]);
paired("hip", "hip", "pelvis", FRONT, [[50, 222], [86, 222], [90, 258], [50, 258]]);

center("mid-back", "Mid back", "back", BACK, rect(60, 141, 140, 186));
paired("lower-back", "lower back", "back", BACK, rect(50, 186, 100, 222));
paired("glute", "buttock", "pelvis", BACK, rect(50, 222, 100, 266));

paired("thigh-front", "front of thigh", "leg", FRONT, rect(50, 258, 100, 338));
paired("thigh-back", "back of thigh", "leg", BACK, rect(50, 266, 100, 338));
paired("knee", "knee", "leg", BOTH, rect(50, 338, 100, 366));
paired("shin", "shin", "leg", FRONT, rect(50, 366, 100, 430));
paired("calf", "calf", "leg", BACK, rect(50, 366, 100, 430));
paired("foot", "ankle / foot", "foot", BOTH, rect(50, 430, 100, 470));

export const REGION_BY_ID: Record<string, Region> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

export function regionLabel(id: string): string {
  return REGION_BY_ID[id]?.label ?? id;
}

export function isRegionId(id: string): boolean {
  return id in REGION_BY_ID;
}

export function shapesFor(view: View): Shape[] {
  return SHAPES.filter((s) => s.view === view);
}

/** Which view an area is best seen on, for turning the figure to a selection. */
export function primaryView(id: string): View {
  return SHAPES.some((s) => s.regionId === id && s.view === "front") ? "front" : "back";
}
