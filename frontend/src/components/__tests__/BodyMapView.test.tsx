import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import BodyMapView from "../BodyMapView";
import type { PainMarker, SymptomDescriptor } from "@bodytrace/shared";

// Mock BodyModelRenderer since it uses Three.js / WebGL
vi.mock("../BodyModelRenderer", () => ({
  default: ({ markers, showBodyMap }: { markers: PainMarker[]; showBodyMap: boolean }) => (
    <div data-testid="body-model-renderer" data-marker-count={markers.length} data-show-body-map={showBodyMap} />
  ),
}));

const makeMarker = (overrides: Partial<PainMarker> = {}): PainMarker => ({
  id: "m1",
  sessionId: "s1",
  location: {
    region: { id: "left-shoulder", name: "Left Shoulder", bodySystem: "musculoskeletal" },
    coordinates: { x: -0.28, y: 1.18, z: 0 },
  },
  intensity: 6,
  createdAt: new Date("2024-06-15"),
  status: "active",
  ...overrides,
});

const makeDescriptor = (overrides: Partial<SymptomDescriptor> = {}): SymptomDescriptor => ({
  id: "d1",
  markerId: "m1",
  painType: "sharp",
  intensity: 6,
  frequency: "intermittent",
  duration: "hours",
  followUpResponses: [],
  completedAt: new Date("2024-06-15"),
  ...overrides,
});

const markers: PainMarker[] = [
  makeMarker({ id: "m1", intensity: 6, status: "active" }),
  makeMarker({
    id: "m2",
    intensity: 3,
    status: "resolved",
    location: {
      region: { id: "lower-back", name: "Lower Back", bodySystem: "musculoskeletal" },
      coordinates: { x: 0, y: 0.95, z: -0.1 },
    },
    createdAt: new Date("2024-03-01"),
  }),
  makeMarker({
    id: "m3",
    intensity: 8,
    status: "historical",
    createdAt: new Date("2023-01-10"),
  }),
];

const descriptors: SymptomDescriptor[] = [
  makeDescriptor({ id: "d1", markerId: "m1", painType: "sharp" }),
  makeDescriptor({
    id: "d2",
    markerId: "m2",
    painType: "dull",
    frequency: "constant",
    duration: "days",
    followUpResponses: [
      {
        questionId: "q1",
        questionText: "Does it hurt when bending?",
        response: "Yes, especially in the morning",
        answeredAt: new Date("2024-03-01"),
      },
    ],
  }),
  makeDescriptor({ id: "d3", markerId: "m3", painType: "burning" }),
];

describe("BodyMapView", () => {
  it("renders the BodyModelRenderer with showBodyMap=true", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    const renderer = screen.getByTestId("body-model-renderer");
    expect(renderer).toHaveAttribute("data-show-body-map", "true");
  });

  it("renders all markers in the marker list", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    expect(screen.getByText(/Left Shoulder — Intensity 6 — Active/)).toBeInTheDocument();
    expect(screen.getByText(/Lower Back — Intensity 3 — Resolved/)).toBeInTheDocument();
    expect(screen.getByText(/Left Shoulder — Intensity 8 — Historical/)).toBeInTheDocument();
  });

  it("shows detail panel when a marker is selected", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    const btn = screen.getByLabelText(/Select marker at Lower Back, intensity 3, status resolved/i);
    fireEvent.click(btn);

    // The detail panel heading should show the region name
    const detailPanel = screen.getByRole("region", { name: /Detail panel for marker at Lower Back/ });
    expect(detailPanel).toBeInTheDocument();
    expect(detailPanel).toHaveTextContent("Dull");
    expect(detailPanel).toHaveTextContent("Constant");
    expect(detailPanel).toHaveTextContent("Days");
  });

  it("displays follow-up responses in the detail panel", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    fireEvent.click(screen.getByLabelText(/Select marker at Lower Back/i));

    expect(screen.getByText("Does it hurt when bending?")).toBeInTheDocument();
    expect(screen.getByText("Yes, especially in the morning")).toBeInTheDocument();
  });

  it("deselects a marker when clicking it again", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    const btn = screen.getByLabelText(/Select marker at Lower Back/i);
    fireEvent.click(btn);
    expect(screen.getByText(/Pain Type:/)).toBeInTheDocument();

    fireEvent.click(btn);
    expect(screen.queryByText(/Pain Type:/)).not.toBeInTheDocument();
  });

  it("renders filter controls with proper aria labels", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    expect(screen.getByLabelText("Filter start date")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter end date")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by anatomical region")).toBeInTheDocument();
    expect(screen.getByLabelText("Minimum intensity filter")).toBeInTheDocument();
    expect(screen.getByLabelText("Maximum intensity filter")).toBeInTheDocument();
  });

  it("renders pain type filter checkboxes", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    expect(screen.getByLabelText(/Filter by pain type: Sharp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by pain type: Dull/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by pain type: Burning/i)).toBeInTheDocument();
  });

  it("filters markers by pain type", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    fireEvent.click(screen.getByLabelText(/Filter by pain type: Dull/i));

    // Only the dull marker (m2 - Lower Back) should remain
    expect(screen.getByText(/Lower Back — Intensity 3 — Resolved/)).toBeInTheDocument();
    expect(screen.queryByText(/Left Shoulder — Intensity 6 — Active/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Left Shoulder — Intensity 8 — Historical/)).not.toBeInTheDocument();
  });

  it("filters markers by region", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    fireEvent.change(screen.getByLabelText("Filter by anatomical region"), {
      target: { value: "lower-back" },
    });

    expect(screen.getByText(/Lower Back — Intensity 3 — Resolved/)).toBeInTheDocument();
    expect(screen.queryByText(/Left Shoulder — Intensity 6 — Active/)).not.toBeInTheDocument();
  });

  it("calls onFilterChange when filters are updated", () => {
    const onFilterChange = vi.fn();
    render(
      <BodyMapView markers={markers} descriptors={descriptors} onFilterChange={onFilterChange} />
    );
    fireEvent.click(screen.getByLabelText(/Filter by pain type: Sharp/i));
    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ painTypes: ["sharp"] })
    );
  });

  it("shows empty state when no markers match filters", () => {
    render(<BodyMapView markers={[]} descriptors={[]} />);
    expect(screen.getByText("No markers match the current filters.")).toBeInTheDocument();
  });

  it("has proper aria-label on the main region", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    expect(screen.getByRole("region", { name: "Body Map View" })).toBeInTheDocument();
  });

  it("has proper aria-pressed attribute on marker buttons", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    const btn = screen.getByLabelText(/Select marker at Lower Back/i);
    expect(btn).toHaveAttribute("aria-pressed", "false");
    
    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("has proper aria-label on detail panel region", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    fireEvent.click(screen.getByLabelText(/Select marker at Lower Back/i));
    
    expect(screen.getByRole("region", { name: /Detail panel for marker at Lower Back/i })).toBeInTheDocument();
  });

  it("has proper aria labels for filter controls", () => {
    render(<BodyMapView markers={markers} descriptors={descriptors} />);
    expect(screen.getByRole("group", { name: /pain type filter/i })).toBeInTheDocument();
  });
});
