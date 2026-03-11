// Feature: body-trace, Property 2: Pain intensity to color mapping
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { intensityToColor } from "../BodyModelRenderer";

/**
 * Validates: Requirements 1.5
 *
 * Property 2: Pain intensity to color mapping
 * For any pain intensity value in the range 0–10, the color mapping function
 * should return a distinct, deterministic color, and different intensity values
 * should produce visually distinguishable colors.
 */

// Arbitrary for integer intensity values 0–10
const intensityArb = fc.integer({ min: 0, max: 10 });

describe("Property 2: Pain intensity to color mapping", () => {
  it("should return a valid hex color string for any intensity 0–10", () => {
    fc.assert(
      fc.property(intensityArb, (intensity) => {
        const color = intensityToColor(intensity);
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      }),
      { numRuns: 20 }
    );
  });

  it("should be deterministic: same intensity always produces the same color", () => {
    fc.assert(
      fc.property(intensityArb, (intensity) => {
        const color1 = intensityToColor(intensity);
        const color2 = intensityToColor(intensity);
        expect(color1).toBe(color2);
      }),
      { numRuns: 20 }
    );
  });

  it("should produce different colors for different integer intensity values", () => {
    fc.assert(
      fc.property(
        intensityArb,
        intensityArb.filter((v, _) => true),
        (a, b) => {
          fc.pre(a !== b);
          const colorA = intensityToColor(a);
          const colorB = intensityToColor(b);
          expect(colorA).not.toBe(colorB);
        }
      ),
      { numRuns: 20 }
    );
  });
});
