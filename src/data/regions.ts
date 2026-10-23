/**
 * Body regions and their outline on a 200×470 front/back figure.
 *
 * Front view: the person faces you, so their RIGHT side is on the viewer's left.
 * Back view: you see their back, so their LEFT side is on the viewer's left.
 * Paired shapes are drawn once for the viewer's left and mirrored.
 */

export type View = "front" | "back";
export type Side = "left" | "right" | "center";
export type Group =
  | "head"
  | "neck"
  | "shoulder"
  | "arm"
  | "chest"
  | "abdomen"
  | "back"
  | "pelvis"
  | "leg"
  | "foot";

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

function poly(points: Pt[]): string {
  return "M" + points.map(([x, y]) => `${x} ${y}`).join(" L") + " Z";
}

function mirror(points: Pt[]): Pt[] {
  return points.map(([x, y]) => [W - x, y] as Pt);
}

interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

type Geometry = Pt[] | Ellipse;

function pathOf(g: Geometry): string {
  if (Array.isArray(g)) return poly(g);
  const { cx, cy, rx, ry } = g;
  return `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0 Z`;
}

function containsFn(g: Geometry): (x: number, y: number) => boolean {
  if (!Array.isArray(g)) return (x, y) => ((x - g.cx) / g.rx) ** 2 + ((y - g.cy) / g.ry) ** 2 <= 1;
  // Even-odd ray casting.
  return (x, y) => {
    let inside = false;
    for (let i = 0, j = g.length - 1; i < g.length; j = i++) {
      const [xi, yi] = g[i];
      const [xj, yj] = g[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
}

function bboxOf(g: Geometry): Shape["bbox"] {
  if (!Array.isArray(g)) return [g.cx - g.rx, g.cy - g.ry, g.cx + g.rx, g.cy + g.ry];
  const xs = g.map((p) => p[0]);
  const ys = g.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function shape(regionId: string, view: View, g: Geometry): Shape {
  return { regionId, view, d: pathOf(g), contains: containsFn(g), bbox: bboxOf(g) };
}

// Viewer-left outlines, reused for both views.
const G = {
  shoulder: [[89, 82], [70, 84], [56, 92], [50, 108], [51, 120], [68, 120], [73, 104], [77, 95]] as Pt[],
  upperTorsoHalf: [[100, 86], [89, 84], [78, 97], [73, 140], [100, 141]] as Pt[],
  upperArm: [[51, 123], [68, 123], [66, 179], [47, 177]] as Pt[],
  elbow: [[47, 180], [66, 182], [64, 197], [44, 195]] as Pt[],
  forearm: [[44, 198], [64, 200], [58, 249], [42, 247]] as Pt[],
  hand: [[42, 250], [58, 252], [60, 271], [54, 288], [42, 288], [35, 269]] as Pt[],
  knee: [[76, 339], [96, 339], [95, 364], [77, 364]] as Pt[],
  lowerLeg: [[77, 367], [95, 367], [92, 428], [80, 428]] as Pt[],
  foot: [[80, 431], [92, 431], [97, 450], [71, 452], [74, 441]] as Pt[],
};

const FRONT_ONLY = {
  hip: [[72, 224], [86, 224], [90, 252], [70, 250], [68, 236]] as Pt[],
  thigh: [[70, 253], [90, 255], [99, 262], [96, 336], [76, 336], [70, 290]] as Pt[],
};

const BACK_ONLY = {
  lowerBack: [[74, 188], [100, 188], [100, 222], [72, 222]] as Pt[],
  glute: [[72, 224], [100, 224], [100, 257], [90, 262], [72, 257], [68, 238]] as Pt[],
  thigh: [[72, 260], [90, 265], [99, 265], [96, 336], [76, 336], [70, 290]] as Pt[],
};

export const REGIONS: Region[] = [];
export const SHAPES: Shape[] = [];

function add(region: Region) {
  if (!REGIONS.some((r) => r.id === region.id)) REGIONS.push(region);
}

function center(id: string, label: string, group: Group, view: View, g: Geometry) {
  add({ id, label, side: "center", group });
  SHAPES.push(shape(id, view, g));
}

/** Adds the left and right versions of a region, drawn on the given views. */
function paired(base: string, label: string, group: Group, views: View[], pts: Pt[]) {
  for (const side of ["right", "left"] as const) {
    const id = `${base}-${side === "right" ? "r" : "l"}`;
    add({ id, label: `${side === "right" ? "Right" : "Left"} ${label}`, side, group });
    for (const view of views) {
      // The viewer-left outline belongs to the body's right in front view and left in back view.
      const onViewerLeft = (view === "front") === (side === "right");
      SHAPES.push(shape(id, view, onViewerLeft ? pts : mirror(pts)));
    }
  }
}

const BOTH: View[] = ["front", "back"];

// Head and neck
center("head", "Head / face", "head", "front", { cx: 100, cy: 40, rx: 22, ry: 27 });
center("head-back", "Back of head", "head", "back", { cx: 100, cy: 40, rx: 22, ry: 27 });
center("neck-front", "Front of neck", "neck", "front", [[90, 64], [110, 64], [112, 82], [88, 82]]);
center("neck-back", "Back of neck", "neck", "back", [[90, 64], [110, 64], [112, 82], [88, 82]]);

// Shoulders and arms
paired("shoulder", "shoulder", "shoulder", BOTH, G.shoulder);
paired("upper-arm", "upper arm", "arm", BOTH, G.upperArm);
paired("elbow", "elbow", "arm", BOTH, G.elbow);
paired("forearm", "forearm", "arm", BOTH, G.forearm);
paired("hand", "wrist / hand", "arm", BOTH, G.hand);

// Front torso
paired("chest", "chest", "chest", ["front"], G.upperTorsoHalf);
center("upper-abdomen", "Upper abdomen", "abdomen", "front", [[73, 143], [127, 143], [126, 186], [74, 186]]);
center("lower-abdomen", "Lower abdomen", "abdomen", "front", [[74, 188], [126, 188], [128, 222], [72, 222]]);
center("groin", "Groin / pelvis", "pelvis", "front", [[87, 224], [113, 224], [110, 252], [100, 258], [90, 252]]);
paired("hip", "hip", "pelvis", ["front"], FRONT_ONLY.hip);

// Back torso
paired("upper-back", "upper back", "back", ["back"], G.upperTorsoHalf);
center("mid-back", "Mid back", "back", "back", [[73, 143], [127, 143], [126, 186], [74, 186]]);
paired("lower-back", "lower back", "back", ["back"], BACK_ONLY.lowerBack);
paired("glute", "buttock", "pelvis", ["back"], BACK_ONLY.glute);

// Legs
paired("thigh-front", "front of thigh", "leg", ["front"], FRONT_ONLY.thigh);
paired("thigh-back", "back of thigh", "leg", ["back"], BACK_ONLY.thigh);
paired("knee", "knee", "leg", BOTH, G.knee);
paired("shin", "shin", "leg", ["front"], G.lowerLeg);
paired("calf", "calf", "leg", ["back"], G.lowerLeg);
paired("foot", "ankle / foot", "foot", BOTH, G.foot);

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

/** Which view a region is best seen on, for jumping the figure to a selection. */
export function primaryView(id: string): View {
  return SHAPES.find((s) => s.regionId === id && s.view === "front") ? "front" : "back";
}
