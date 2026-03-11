import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import App from "../App";

describe("Frontend setup", () => {
  it("should have a working test environment", () => {
    expect(true).toBe(true);
  });

  it("should render the App component", () => {
    render(<App />);
    expect(screen.getByText("BodyTrace")).toBeInTheDocument();
  });

  it("should have fast-check available", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return typeof s === "string";
      })
    );
  });
});
