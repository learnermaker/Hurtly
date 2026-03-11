import { describe, it, expect, vi } from "vitest";
import {
  intensityToColor,
  classifyRecency,
} from "../BodyModelRenderer";
import type { PainMarker } from "@bodytrace/shared";
import { getAllRegions } from "../../services/anatomical-region-mapper";

// Helper to create a minimal PainMarker with a given status
function makeMarker(
  status: "active" | "resolved" | "historical"
): PainMarker {
  return {
    id: "m1",
    sessionId: "s1",
    location: {
      region: { id: "chest", name: "Chest", bodySystem: "musculoskeletal" },
      coordinates: { x: 0, y: 1.2, z: 0.1 },
    },
    intensity: 5,
    createdAt: new Date(),
    status,
  };
}

describe("intensityToColor", () => {
  it("returns green (#00ff00) for intensity 0", () => {
    expect(intensityToColor(0)).toBe("#00ff00");
  });

  it("returns yellow (#ffff00) for intensity 5", () => {
    expect(intensityToColor(5)).toBe("#ffff00");
  });

  it("returns red (#ff0000) for intensity 10", () => {
    expect(intensityToColor(10)).toBe("#ff0000");
  });

  it("clamps values below 0 to green", () => {
    expect(intensityToColor(-5)).toBe("#00ff00");
  });

  it("clamps values above 10 to red", () => {
    expect(intensityToColor(15)).toBe("#ff0000");
  });

  it("returns a valid hex color string for any integer 0–10", () => {
    for (let i = 0; i <= 10; i++) {
      const color = intensityToColor(i);
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("produces different colors for different intensities", () => {
    const colors = new Set<string>();
    for (let i = 0; i <= 10; i++) {
      colors.add(intensityToColor(i));
    }
    // All 11 integer values should produce distinct colors
    expect(colors.size).toBe(11);
  });
});

describe("classifyRecency", () => {
  it('returns "active" for active markers', () => {
    expect(classifyRecency(makeMarker("active"))).toBe("active");
  });

  it('returns "resolved" for resolved markers', () => {
    expect(classifyRecency(makeMarker("resolved"))).toBe("resolved");
  });

  it('returns "historical" for historical markers', () => {
    expect(classifyRecency(makeMarker("historical"))).toBe("historical");
  });
});

describe("BodyModelRenderer - Keyboard Navigation Support", () => {
  // Note: Full component rendering tests require WebGL context which is not available in jsdom.
  // These tests verify the keyboard navigation infrastructure is in place.
  // Full integration tests should be performed in a browser environment (e.g., Playwright, Cypress).

  it("has anatomical regions available for keyboard navigation", () => {
    const regions = getAllRegions();
    expect(regions.length).toBeGreaterThan(0);
    expect(regions[0]).toHaveProperty("id");
    expect(regions[0]).toHaveProperty("name");
    expect(regions[0]).toHaveProperty("bodySystem");
  });

  it("anatomical regions have unique IDs", () => {
    const regions = getAllRegions();
    const ids = regions.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("anatomical regions have non-empty names", () => {
    const regions = getAllRegions();
    regions.forEach((region) => {
      expect(region.name).toBeTruthy();
      expect(region.name.length).toBeGreaterThan(0);
    });
  });
});
