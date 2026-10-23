import { REGIONS, SHAPES, REGION_BY_ID, shapesFor } from "../data/regions";

function centroidX(d: string): number {
  const xs = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

describe("regions", () => {
  it("has unique ids and every region is drawn somewhere", () => {
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length);
    for (const r of REGIONS) expect(SHAPES.some((s) => s.regionId === r.id)).toBe(true);
  });

  it("draws each region at most once per view", () => {
    for (const view of ["front", "back"] as const) {
      const ids = shapesFor(view).map((s) => s.regionId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("puts the body's right on the viewer's left from the front, and on the viewer's right from behind", () => {
    for (const s of SHAPES) {
      const side = REGION_BY_ID[s.regionId].side;
      if (side === "center") continue;
      const onViewerLeft = centroidX(s.d) < 100;
      const expected = s.view === "front" ? side === "right" : side === "left";
      expect(onViewerLeft, `${s.regionId} on ${s.view}`).toBe(expected);
    }
  });

  it("labels sides consistently with ids", () => {
    for (const r of REGIONS) {
      if (r.id.endsWith("-r")) expect(r.label.startsWith("Right")).toBe(true);
      if (r.id.endsWith("-l")) expect(r.label.startsWith("Left")).toBe(true);
    }
  });
});
