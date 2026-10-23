import { REGIONS, SHAPES } from "../data/regions";
import { brush, brushLine, cellRegions, decodeMask, emptyMask, emptyPaint, encodeMask, fromDrawing, heatCells, paintFromRegions, regionAt, regionsInMask, regionsInPaint, toDrawing } from "../lib/mask";
import { makeEntry } from "./helpers";

it("gives every region enough grid cells to paint", () => {
  for (const s of SHAPES) {
    const idx = REGIONS.findIndex((r) => r.id === s.regionId);
    expect(cellRegions(s.view).filter((c) => c === idx).length, `${s.regionId} ${s.view}`).toBeGreaterThan(10);
  }
});

it("maps taps to the correct side", () => {
  expect(regionAt("front", 86, 350)).toBe("knee-r");
  expect(regionAt("front", 114, 350)).toBe("knee-l");
  expect(regionAt("back", 114, 350)).toBe("knee-r");
  expect(regionAt("front", 5, 5)).toBeNull();
});

describe("painting", () => {
  it("stays inside the body and finds the painted area without grazed neighbours", () => {
    const m = emptyMask();
    brush(m, "front", 10, 10, 30, 1);
    expect(m.some(Boolean)).toBe(false);
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

  it("recognises every area filled by name as exactly that area", () => {
    for (const r of REGIONS) expect(regionsInPaint(paintFromRegions([r.id])), r.id).toEqual([r.id]);
  });

  it("fills named areas on every view they appear on", () => {
    const p = paintFromRegions(["shoulder-r", "lower-back-r"]);
    expect(regionsInMask(p.front, "front")).toEqual(["shoulder-r"]);
    expect(regionsInPaint(p)).toEqual(["shoulder-r", "lower-back-r"]);
  });
});

it("stores drawings compactly and restores them exactly", () => {
  expect(toDrawing(emptyPaint())).toBeUndefined();
  const p = emptyPaint();
  brushLine(p.back, "back", [80, 100], [120, 200], 9, 1);
  p.arrows.push({ view: "back", from: [90, 200], to: [85, 300] });
  const d = toDrawing(p)!;
  expect(d.back!.length).toBeLessThan(2600);
  expect(fromDrawing(d)).toEqual(p);
  expect(decodeMask(encodeMask(p.back))).toEqual(p.back);
});

it("heat keeps the worst intensity per cell and fills entries saved without a drawing", () => {
  const painted = emptyPaint();
  brush(painted.front, "front", 112, 300, 9, 1);
  const h = heatCells(
    [
      makeEntry({ regions: ["thigh-front-l"], intensity: 3 }),
      makeEntry({ regions: ["thigh-front-l"], drawing: toDrawing(painted), intensity: 8 }),
      makeEntry({ kind: "clear", intensity: 0 }),
    ],
    "front",
  );
  expect(h[Math.floor(300 / 2.5) * 80 + Math.floor(112 / 2.5)]).toBe(8);
  expect(h.filter((v) => v === 3).length).toBeGreaterThan(50);
});
