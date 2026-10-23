import { REGIONS, REGION_BY_ID, SHAPES } from "../data/regions";

describe("regions", () => {
  it("has unique ids and draws every region", () => {
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length);
    for (const r of REGIONS) expect(SHAPES.some((s) => s.regionId === r.id)).toBe(true);
  });

  it("puts the body's right on the viewer's left from the front, and on the viewer's right from behind", () => {
    for (const s of SHAPES) {
      const side = REGION_BY_ID[s.regionId].side;
      if (side === "center") continue;
      const centerX = (s.bbox[0] + s.bbox[2]) / 2;
      const expectedViewerLeft = s.view === "front" ? side === "right" : side === "left";
      expect(centerX < 100, `${s.regionId} on ${s.view}`).toBe(expectedViewerLeft);
    }
  });
});
