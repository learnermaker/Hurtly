import { REGIONS, SHAPES } from "../data/regions";
import {
  CELLS,
  brush,
  brushLine,
  cellRegions,
  decodeMask,
  emptyMask,
  emptyPaint,
  encodeMask,
  fromDrawing,
  heatCells,
  paintFromRegions,
  regionAt,
  regionsInMask,
  regionsInPaint,
  toDrawing,
} from "../lib/mask";
import type { Entry } from "../lib/types";

describe("cell map", () => {
  it("assigns every region at least a few cells on each view it's drawn on", () => {
    for (const s of SHAPES) {
      const idx = REGIONS.findIndex((r) => r.id === s.regionId);
      const n = cellRegions(s.view).filter((c) => c === idx).length;
      expect(n, `${s.regionId} ${s.view}`).toBeGreaterThan(10);
    }
  });

  it("knows which side is which when tapping", () => {
    // Viewer's right half at knee height is the LEFT knee from the front and the RIGHT knee from behind.
    expect(regionAt("front", 86, 350)).toBe("knee-r");
    expect(regionAt("front", 114, 350)).toBe("knee-l");
    expect(regionAt("back", 114, 350)).toBe("knee-r");
    expect(regionAt("front", 5, 5)).toBeNull();
  });
});

describe("painting", () => {
  it("never paints outside the body", () => {
    const m = emptyMask();
    brush(m, "front", 10, 10, 30, 1);
    expect(m.some(Boolean)).toBe(false);
  });

  it("derives the region painted, without grazed neighbours", () => {
    const m = emptyMask();
    // Mid-thigh on the viewer's right from the front = left thigh.
    brushLine(m, "front", [112, 280], [112, 320], 9, 1);
    expect(regionsInMask(m, "front")).toEqual(["thigh-front-l"]);
  });

  it("erases", () => {
    const m = emptyMask();
    brush(m, "back", 88, 205, 9, 1);
    expect(regionsInMask(m, "back")).toEqual(["lower-back-l"]);
    brush(m, "back", 88, 205, 12, 0);
    expect(regionsInMask(m, "back")).toEqual([]);
  });

  it("fills named regions on every view they appear", () => {
    const p = paintFromRegions(["shoulder-r", "lower-back-r"]);
    expect(regionsInMask(p.front, "front")).toEqual(["shoulder-r"]);
    expect(regionsInMask(p.back, "back").sort()).toEqual(["lower-back-r", "shoulder-r"]);
    expect(regionsInPaint(p)).toEqual(["shoulder-r", "lower-back-r"]);
  });
});

describe("storage", () => {
  it("round-trips a mask through base64 bits", () => {
    const m = emptyMask();
    brushLine(m, "front", [80, 100], [120, 200], 9, 1);
    const encoded = encodeMask(m)!;
    expect(encoded.length).toBeLessThan(2600);
    expect(decodeMask(encoded)).toEqual(m);
    expect(encodeMask(emptyMask())).toBeUndefined();
  });

  it("round-trips arrows and stores nothing for a blank drawing", () => {
    const p = emptyPaint();
    expect(toDrawing(p)).toBeUndefined();
    p.arrows.push({ view: "back", from: [90, 200], to: [85, 300] });
    brush(p.back, "back", 90, 200, 9, 1);
    const back = fromDrawing(toDrawing(p));
    expect(back.arrows).toEqual(p.arrows);
    expect(back.back).toEqual(p.back);
    expect(back.front.some(Boolean)).toBe(false);
  });
});

describe("heatCells", () => {
  const base = { qualities: [], triggers: [], relief: [], impact: [], followUps: [], source: "tap" as const, createdAt: 0 };

  it("keeps the worst intensity per cell and fills old region-only entries", () => {
    const painted = emptyPaint();
    brush(painted.front, "front", 112, 300, 9, 1);
    const entries: Entry[] = [
      { ...base, id: "a", kind: "pain", regions: ["thigh-front-l"], intensity: 3 },
      { ...base, id: "b", kind: "pain", regions: ["thigh-front-l"], drawing: toDrawing(painted), intensity: 8 },
      { ...base, id: "c", kind: "clear", regions: [], intensity: 0 },
    ];
    const h = heatCells(entries, "front");
    const idx = Math.floor(300 / 2.5) * 80 + Math.floor(112 / 2.5);
    expect(h[idx]).toBe(8);
    const thighCells = cellRegions("front").reduce((n, r, i) => n + (REGIONS[r]?.id === "thigh-front-l" && h[i] === 3 ? 1 : 0), 0);
    expect(thighCells).toBeGreaterThan(50);
    expect(h.length).toBe(CELLS);
  });
});
