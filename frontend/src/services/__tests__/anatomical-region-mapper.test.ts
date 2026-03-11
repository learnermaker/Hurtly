import { describe, it, expect } from "vitest";
import {
  resolve,
  resolveArea,
  getAllRegions,
  searchRegions,
} from "../anatomical-region-mapper";
import type { AnatomicalBoundary } from "@bodytrace/shared";

describe("anatomical-region-mapper", () => {
  describe("resolve", () => {
    it("maps a point in the center of the chest to the chest region", () => {
      const region = resolve({ x: 0, y: 1.2, z: 0.07 });
      expect(region.id).toBe("chest");
      expect(region.name).toBe("Chest");
    });

    it("maps a point in the head bounding box to the head region", () => {
      const region = resolve({ x: 0, y: 1.7, z: 0 });
      expect(region.id).toBe("head");
    });

    it("maps a point in the left knee area", () => {
      const region = resolve({ x: -0.1, y: 0.43, z: 0 });
      expect(region.id).toBe("left-knee");
    });

    it("returns the nearest region for a point outside all bounding boxes", () => {
      // A point far above the head should resolve to head (nearest)
      const region = resolve({ x: 0, y: 5.0, z: 0 });
      expect(region.id).toBe("head");
    });

    it("returns a region with all required fields", () => {
      const region = resolve({ x: 0, y: 1.0, z: -0.1 });
      expect(region.id).toBeDefined();
      expect(region.name).toBeDefined();
      expect(region.bodySystem).toBeDefined();
      expect(region.name.length).toBeGreaterThan(0);
    });
  });

  describe("resolveArea", () => {
    it("returns multiple regions when boundary spans across them", () => {
      const boundary: AnatomicalBoundary = {
        regions: [],
        points: [
          { x: 0, y: 1.7, z: 0 },   // head
          { x: 0, y: 1.5, z: 0 },   // neck
          { x: 0, y: 1.2, z: 0.07 }, // chest
        ],
      };
      const regions = resolveArea(boundary);
      const ids = regions.map((r) => r.id);
      expect(ids).toContain("head");
      expect(ids).toContain("neck");
      expect(ids).toContain("chest");
    });

    it("returns unique regions even when multiple points map to the same region", () => {
      const boundary: AnatomicalBoundary = {
        regions: [],
        points: [
          { x: 0, y: 1.7, z: 0 },
          { x: 0.05, y: 1.7, z: 0 },
          { x: -0.05, y: 1.7, z: 0 },
        ],
      };
      const regions = resolveArea(boundary);
      expect(regions).toHaveLength(1);
      expect(regions[0].id).toBe("head");
    });

    it("returns an empty array for an empty boundary", () => {
      const boundary: AnatomicalBoundary = { regions: [], points: [] };
      const regions = resolveArea(boundary);
      expect(regions).toHaveLength(0);
    });
  });

  describe("getAllRegions", () => {
    it("returns all 24 anatomical regions", () => {
      const regions = getAllRegions();
      expect(regions.length).toBe(24);
    });

    it("includes expected regions", () => {
      const ids = getAllRegions().map((r) => r.id);
      expect(ids).toContain("head");
      expect(ids).toContain("left-shoulder");
      expect(ids).toContain("right-foot");
      expect(ids).toContain("lower-back");
    });

    it("every region has id, name, and bodySystem", () => {
      for (const region of getAllRegions()) {
        expect(region.id).toBeTruthy();
        expect(region.name).toBeTruthy();
        expect(region.bodySystem).toBeTruthy();
      }
    });
  });

  describe("searchRegions", () => {
    it("finds regions by case-insensitive substring match", () => {
      const results = searchRegions("shoulder");
      expect(results.length).toBe(2);
      expect(results.map((r) => r.id)).toContain("left-shoulder");
      expect(results.map((r) => r.id)).toContain("right-shoulder");
    });

    it("is case-insensitive", () => {
      const results = searchRegions("LEFT");
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.name.toLowerCase()).toContain("left");
      }
    });

    it("returns empty array for no matches", () => {
      const results = searchRegions("zzzznonexistent");
      expect(results).toHaveLength(0);
    });

    it("returns all regions for an empty query", () => {
      const results = searchRegions("");
      expect(results.length).toBe(24);
    });

    it("finds a region by exact name", () => {
      const results = searchRegions("Lower Back");
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("lower-back");
    });
  });
});
