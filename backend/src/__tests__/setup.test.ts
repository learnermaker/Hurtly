import { describe, it, expect } from "vitest";
import fc from "fast-check";

describe("Backend setup", () => {
  it("should have a working test environment", () => {
    expect(true).toBe(true);
  });

  it("should have fast-check available", () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return typeof n === "number";
      })
    );
  });
});
