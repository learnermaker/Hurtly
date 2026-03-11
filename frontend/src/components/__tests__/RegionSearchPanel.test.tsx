import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegionSearchPanel from "../RegionSearchPanel";
import type { AnatomicalLocation } from "@bodytrace/shared";

describe("RegionSearchPanel", () => {
  it("renders search input and all regions by default", () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    expect(screen.getByLabelText(/search anatomical regions/i)).toBeInTheDocument();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    
    // Should show all 24 regions initially
    const regions = screen.getAllByRole("option");
    expect(regions.length).toBe(24);
  });

  it("filters regions based on search query", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    const searchInput = screen.getByLabelText(/search anatomical regions/i);
    
    await userEvent.type(searchInput, "shoulder");

    await waitFor(() => {
      const regions = screen.getAllByRole("option");
      expect(regions.length).toBe(2); // Left Shoulder and Right Shoulder
      expect(screen.getByText("Left Shoulder")).toBeInTheDocument();
      expect(screen.getByText("Right Shoulder")).toBeInTheDocument();
    });
  });

  it("shows no results message when search has no matches", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    const searchInput = screen.getByLabelText(/search anatomical regions/i);
    
    await userEvent.type(searchInput, "nonexistent");

    await waitFor(() => {
      expect(screen.getByText(/no regions found matching/i)).toBeInTheDocument();
    });
  });

  it("calls onRegionSelect with correct location when region is clicked", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    const searchInput = screen.getByLabelText(/search anatomical regions/i);
    await userEvent.type(searchInput, "head");

    await waitFor(() => {
      const headRegion = screen.getByText("Head");
      fireEvent.click(headRegion);
    });

    expect(onRegionSelect).toHaveBeenCalledTimes(1);
    const call = onRegionSelect.mock.calls[0][0] as AnatomicalLocation;
    expect(call.region.id).toBe("head");
    expect(call.region.name).toBe("Head");
    expect(call.coordinates).toEqual({ x: 0, y: 1.72, z: 0 });
  });

  it("supports keyboard navigation with arrow keys", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    const searchInput = screen.getByLabelText(/search anatomical regions/i);
    await userEvent.type(searchInput, "knee");

    await waitFor(() => {
      expect(screen.getAllByRole("option").length).toBe(2);
    });

    // Press ArrowDown to focus first item
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    
    await waitFor(() => {
      const firstOption = screen.getAllByRole("option")[0];
      expect(firstOption).toHaveAttribute("aria-selected", "true");
    });

    // Press ArrowDown again to focus second item
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    
    await waitFor(() => {
      const secondOption = screen.getAllByRole("option")[1];
      expect(secondOption).toHaveAttribute("aria-selected", "true");
    });

    // Press ArrowUp to go back to first item
    fireEvent.keyDown(searchInput, { key: "ArrowUp" });
    
    await waitFor(() => {
      const firstOption = screen.getAllByRole("option")[0];
      expect(firstOption).toHaveAttribute("aria-selected", "true");
    });
  });

  it("selects region when Enter is pressed on focused item", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    const searchInput = screen.getByLabelText(/search anatomical regions/i);
    await userEvent.type(searchInput, "neck");

    await waitFor(() => {
      expect(screen.getByText("Neck")).toBeInTheDocument();
    });

    // Focus first item with ArrowDown
    fireEvent.keyDown(searchInput, { key: "ArrowDown" });
    
    await waitFor(() => {
      const option = screen.getByRole("option");
      expect(option).toHaveAttribute("aria-selected", "true");
    });

    // Press Enter to select
    fireEvent.keyDown(searchInput, { key: "Enter" });

    expect(onRegionSelect).toHaveBeenCalledTimes(1);
    const call = onRegionSelect.mock.calls[0][0] as AnatomicalLocation;
    expect(call.region.id).toBe("neck");
  });

  it("clears search when Escape is pressed", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    const searchInput = screen.getByLabelText(/search anatomical regions/i) as HTMLInputElement;
    await userEvent.type(searchInput, "shoulder");

    await waitFor(() => {
      expect(searchInput.value).toBe("shoulder");
      expect(screen.getAllByRole("option").length).toBe(2);
    });

    // Press Escape to clear
    fireEvent.keyDown(searchInput, { key: "Escape" });

    await waitFor(() => {
      expect(searchInput.value).toBe("");
      expect(screen.getAllByRole("option").length).toBe(24);
    });
  });

  it("displays region count status", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    // Initially shows all regions
    expect(screen.getByText(/24 regions available/i)).toBeInTheDocument();

    const searchInput = screen.getByLabelText(/search anatomical regions/i);
    await userEvent.type(searchInput, "foot");

    await waitFor(() => {
      expect(screen.getByText(/2 regions found/i)).toBeInTheDocument();
    });
  });

  it("has proper ARIA attributes for accessibility", () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    const searchInput = screen.getByLabelText(/search anatomical regions/i);
    expect(searchInput).toHaveAttribute("aria-describedby", "region-search-help");
    expect(searchInput).toHaveAttribute("aria-controls", "region-list");

    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("aria-label", "Anatomical regions");

    const options = screen.getAllByRole("option");
    options.forEach((option) => {
      expect(option).toHaveAttribute("aria-selected");
    });
  });

  it("updates focused item on mouse hover", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    const searchInput = screen.getByLabelText(/search anatomical regions/i);
    await userEvent.type(searchInput, "arm");

    await waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options.length).toBeGreaterThan(0);
    });

    const options = screen.getAllByRole("option");
    const secondOption = options[1];

    // Hover over second option
    fireEvent.mouseEnter(secondOption);

    await waitFor(() => {
      expect(secondOption).toHaveAttribute("aria-selected", "true");
    });
  });

  it("shows body system information for each region", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    const searchInput = screen.getByLabelText(/search anatomical regions/i);
    await userEvent.type(searchInput, "chest");

    await waitFor(() => {
      expect(screen.getByText("Chest")).toBeInTheDocument();
      expect(screen.getByText("musculoskeletal")).toBeInTheDocument();
    });
  });

  it("handles case-insensitive search", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    const searchInput = screen.getByLabelText(/search anatomical regions/i);
    
    // Search with uppercase
    await userEvent.type(searchInput, "SHOULDER");

    await waitFor(() => {
      const regions = screen.getAllByRole("option");
      expect(regions.length).toBe(2);
      expect(screen.getByText("Left Shoulder")).toBeInTheDocument();
      expect(screen.getByText("Right Shoulder")).toBeInTheDocument();
    });
  });

  it("prevents default behavior on keyboard navigation", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    const searchInput = screen.getByLabelText(/search anatomical regions/i);
    
    const arrowDownEvent = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    
    const preventDefaultSpy = vi.spyOn(arrowDownEvent, "preventDefault");
    
    searchInput.dispatchEvent(arrowDownEvent);
    
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("maps all regions to correct coordinates", async () => {
    const onRegionSelect = vi.fn();
    render(<RegionSearchPanel onRegionSelect={onRegionSelect} />);

    // Test a few key regions
    const testCases = [
      { search: "head", id: "head", coords: { x: 0, y: 1.72, z: 0 } },
      { search: "left shoulder", id: "left-shoulder", coords: { x: -0.265, y: 1.375, z: 0 } },
      { search: "right foot", id: "right-foot", coords: { x: 0.1, y: 0.05, z: 0.02 } },
    ];

    for (const testCase of testCases) {
      onRegionSelect.mockClear();
      
      const searchInput = screen.getByLabelText(/search anatomical regions/i);
      await userEvent.clear(searchInput);
      await userEvent.type(searchInput, testCase.search);

      await waitFor(() => {
        const region = screen.getByRole("option");
        fireEvent.click(region);
      });

      expect(onRegionSelect).toHaveBeenCalledTimes(1);
      const call = onRegionSelect.mock.calls[0][0] as AnatomicalLocation;
      expect(call.region.id).toBe(testCase.id);
      expect(call.coordinates).toEqual(testCase.coords);
    }
  });
});
