import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { AnatomicalRegion, AnatomicalLocation } from "@bodytrace/shared";
import { getAllRegions, searchRegions } from "../services/anatomical-region-mapper";

export interface RegionSearchPanelProps {
  onRegionSelect: (location: AnatomicalLocation) => void;
}

/**
 * RegionSearchPanel provides a text-based, accessible alternative to 3D body model interaction.
 * Users can search and select anatomical regions from a list, triggering the same
 * characterization workflow as visual selection.
 *
 * Validates: Requirements 10.2, 10.5
 */
export default function RegionSearchPanel({
  onRegionSelect,
}: RegionSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get all regions or filtered results based on search query
  const filteredRegions = useMemo(() => {
    if (!searchQuery.trim()) {
      return getAllRegions();
    }
    return searchRegions(searchQuery);
  }, [searchQuery]);

  // Reset focused index when filtered results change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [filteredRegions]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("li");
      const focusedItem = items[focusedIndex];
      if (focusedItem && typeof focusedItem.scrollIntoView === "function") {
        focusedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [focusedIndex]);

  const handleRegionClick = useCallback(
    (region: AnatomicalRegion) => {
      // Map region to approximate center coordinates for consistency with 3D model
      const regionCenters: Record<string, [number, number, number]> = {
        head: [0, 1.72, 0],
        neck: [0, 1.52, 0],
        "left-shoulder": [-0.265, 1.375, 0],
        "right-shoulder": [0.265, 1.375, 0],
        chest: [0, 1.2, 0.075],
        "upper-back": [0, 1.2, -0.075],
        abdomen: [0, 0.975, 0.075],
        "lower-back": [0, 0.975, -0.075],
        "left-upper-arm": [-0.28, 1.18, 0],
        "right-upper-arm": [0.28, 1.18, 0],
        "left-forearm": [-0.28, 0.9, 0],
        "right-forearm": [0.28, 0.9, 0],
        "left-hand": [-0.28, 0.74, 0],
        "right-hand": [0.28, 0.74, 0],
        "left-hip": [-0.115, 0.8, 0],
        "right-hip": [0.115, 0.8, 0],
        "left-thigh": [-0.1, 0.55, 0],
        "right-thigh": [0.1, 0.55, 0],
        "left-knee": [-0.1, 0.43, 0],
        "right-knee": [0.1, 0.43, 0],
        "left-shin": [-0.1, 0.25, 0],
        "right-shin": [0.1, 0.25, 0],
        "left-foot": [-0.1, 0.05, 0.02],
        "right-foot": [0.1, 0.05, 0.02],
      };

      const coords = regionCenters[region.id] || [0, 1, 0];
      const location: AnatomicalLocation = {
        region,
        coordinates: { x: coords[0], y: coords[1], z: coords[2] },
      };

      onRegionSelect(location);
    },
    [onRegionSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const maxIndex = filteredRegions.length - 1;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, maxIndex));
          break;

        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, -1));
          if (focusedIndex === 0) {
            inputRef.current?.focus();
          }
          break;

        case "Enter":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex <= maxIndex) {
            handleRegionClick(filteredRegions[focusedIndex]);
          }
          break;

        case "Escape":
          e.preventDefault();
          setSearchQuery("");
          setFocusedIndex(-1);
          inputRef.current?.focus();
          break;
      }
    },
    [filteredRegions, focusedIndex, handleRegionClick]
  );

  return (
    <div
      role="search"
      aria-label="Anatomical region search"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "#f9f9f9",
        border: "1px solid #ddd",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Search Input */}
      <div style={{ padding: 16, borderBottom: "1px solid #ddd" }}>
        <label
          htmlFor="region-search-input"
          style={{
            display: "block",
            fontWeight: 600,
            fontSize: 14,
            marginBottom: 8,
            color: "#222",
          }}
        >
          Search Anatomical Regions
        </label>
        <input
          ref={inputRef}
          id="region-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type to search (e.g., shoulder, knee)..."
          aria-describedby="region-search-help"
          aria-controls="region-list"
          aria-activedescendant={
            focusedIndex >= 0 ? `region-item-${focusedIndex}` : undefined
          }
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 14,
            border: "1px solid #ccc",
            borderRadius: 4,
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        <div
          id="region-search-help"
          style={{
            fontSize: 12,
            color: "#666",
            marginTop: 6,
          }}
        >
          Use arrow keys to navigate, Enter to select, Escape to clear
        </div>
      </div>

      {/* Results List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 0",
        }}
      >
        {filteredRegions.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              padding: 16,
              textAlign: "center",
              color: "#666",
              fontSize: 14,
            }}
          >
            No regions found matching "{searchQuery}"
          </div>
        ) : (
          <ul
            ref={listRef}
            id="region-list"
            role="listbox"
            aria-label="Anatomical regions"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {filteredRegions.map((region, index) => (
              <li
                key={region.id}
                id={`region-item-${index}`}
                role="option"
                aria-selected={focusedIndex === index}
                tabIndex={-1}
                onClick={() => handleRegionClick(region)}
                onKeyDown={handleKeyDown}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  backgroundColor:
                    focusedIndex === index ? "#e8f0fe" : "transparent",
                  borderLeft:
                    focusedIndex === index ? "4px solid #4a90d9" : "4px solid transparent",
                  transition: "background-color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "#222",
                    marginBottom: 2,
                  }}
                >
                  {region.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#666",
                  }}
                >
                  {region.bodySystem}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Results Count */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          padding: "8px 16px",
          borderTop: "1px solid #ddd",
          fontSize: 12,
          color: "#666",
          backgroundColor: "#fff",
        }}
      >
        {filteredRegions.length} region{filteredRegions.length !== 1 ? "s" : ""}{" "}
        {searchQuery ? "found" : "available"}
      </div>
    </div>
  );
}
