import type {
  Vector3,
  AnatomicalRegion,
  AnatomicalBoundary,
} from "@bodytrace/shared";

// Bounding box for each anatomical region on the 3D body model.
// Coordinates assume a normalized body model centered at origin,
// Y-axis up, X-axis left-right, Z-axis front-back.
interface RegionBounds {
  region: AnatomicalRegion;
  min: Vector3;
  max: Vector3;
}

const REGION_DATA: RegionBounds[] = [
  {
    region: { id: "head", name: "Head", bodySystem: "musculoskeletal" },
    min: { x: -0.12, y: 1.6, z: -0.12 },
    max: { x: 0.12, y: 1.85, z: 0.12 },
  },
  {
    region: { id: "neck", name: "Neck", bodySystem: "musculoskeletal" },
    min: { x: -0.08, y: 1.45, z: -0.08 },
    max: { x: 0.08, y: 1.6, z: 0.08 },
  },
  {
    region: {
      id: "left-shoulder",
      name: "Left Shoulder",
      bodySystem: "musculoskeletal",
    },
    min: { x: -0.35, y: 1.3, z: -0.1 },
    max: { x: -0.18, y: 1.45, z: 0.1 },
  },
  {
    region: {
      id: "right-shoulder",
      name: "Right Shoulder",
      bodySystem: "musculoskeletal",
    },
    min: { x: 0.18, y: 1.3, z: -0.1 },
    max: { x: 0.35, y: 1.45, z: 0.1 },
  },
  {
    region: { id: "chest", name: "Chest", bodySystem: "musculoskeletal" },
    min: { x: -0.18, y: 1.1, z: 0.0 },
    max: { x: 0.18, y: 1.3, z: 0.15 },
  },
  {
    region: {
      id: "upper-back",
      name: "Upper Back",
      bodySystem: "musculoskeletal",
    },
    min: { x: -0.18, y: 1.1, z: -0.15 },
    max: { x: 0.18, y: 1.3, z: 0.0 },
  },
  {
    region: { id: "abdomen", name: "Abdomen", bodySystem: "musculoskeletal" },
    min: { x: -0.18, y: 0.85, z: 0.0 },
    max: { x: 0.18, y: 1.1, z: 0.15 },
  },
  {
    region: {
      id: "lower-back",
      name: "Lower Back",
      bodySystem: "musculoskeletal",
    },
    min: { x: -0.18, y: 0.85, z: -0.15 },
    max: { x: 0.18, y: 1.1, z: 0.0 },
  },
  {
    region: {
      id: "left-upper-arm",
      name: "Left Upper Arm",
      bodySystem: "musculoskeletal",
    },
    min: { x: -0.45, y: 1.05, z: -0.08 },
    max: { x: -0.3, y: 1.3, z: 0.08 },
  },
  {
    region: {
      id: "right-upper-arm",
      name: "Right Upper Arm",
      bodySystem: "musculoskeletal",
    },
    min: { x: 0.3, y: 1.05, z: -0.08 },
    max: { x: 0.45, y: 1.3, z: 0.08 },
  },
  {
    region: {
      id: "left-forearm",
      name: "Left Forearm",
      bodySystem: "musculoskeletal",
    },
    min: { x: -0.55, y: 0.8, z: -0.07 },
    max: { x: -0.4, y: 1.05, z: 0.07 },
  },
  {
    region: {
      id: "right-forearm",
      name: "Right Forearm",
      bodySystem: "musculoskeletal",
    },
    min: { x: 0.4, y: 0.8, z: -0.07 },
    max: { x: 0.55, y: 1.05, z: 0.07 },
  },
  {
    region: {
      id: "left-hand",
      name: "Left Hand",
      bodySystem: "musculoskeletal",
    },
    min: { x: -0.65, y: 0.6, z: -0.06 },
    max: { x: -0.5, y: 0.8, z: 0.06 },
  },
  {
    region: {
      id: "right-hand",
      name: "Right Hand",
      bodySystem: "musculoskeletal",
    },
    min: { x: 0.5, y: 0.6, z: -0.06 },
    max: { x: 0.65, y: 0.8, z: 0.06 },
  },
  {
    region: {
      id: "left-hip",
      name: "Left Hip",
      bodySystem: "musculoskeletal",
    },
    min: { x: -0.18, y: 0.75, z: -0.1 },
    max: { x: -0.05, y: 0.85, z: 0.1 },
  },
  {
    region: {
      id: "right-hip",
      name: "Right Hip",
      bodySystem: "musculoskeletal",
    },
    min: { x: 0.05, y: 0.75, z: -0.1 },
    max: { x: 0.18, y: 0.85, z: 0.1 },
  },
  {
    region: {
      id: "left-thigh",
      name: "Left Thigh",
      bodySystem: "musculoskeletal",
    },
    min: { x: -0.2, y: 0.45, z: -0.1 },
    max: { x: -0.05, y: 0.75, z: 0.1 },
  },
  {
    region: {
      id: "right-thigh",
      name: "Right Thigh",
      bodySystem: "musculoskeletal",
    },
    min: { x: 0.05, y: 0.45, z: -0.1 },
    max: { x: 0.2, y: 0.75, z: 0.1 },
  },
  {
    region: {
      id: "left-knee",
      name: "Left Knee",
      bodySystem: "musculoskeletal",
    },
    min: { x: -0.18, y: 0.38, z: -0.1 },
    max: { x: -0.05, y: 0.48, z: 0.1 },
  },
  {
    region: {
      id: "right-knee",
      name: "Right Knee",
      bodySystem: "musculoskeletal",
    },
    min: { x: 0.05, y: 0.38, z: -0.1 },
    max: { x: 0.18, y: 0.48, z: 0.1 },
  },
  {
    region: {
      id: "left-shin",
      name: "Left Shin",
      bodySystem: "musculoskeletal",
    },
    min: { x: -0.16, y: 0.12, z: -0.08 },
    max: { x: -0.05, y: 0.38, z: 0.08 },
  },
  {
    region: {
      id: "right-shin",
      name: "Right Shin",
      bodySystem: "musculoskeletal",
    },
    min: { x: 0.05, y: 0.12, z: -0.08 },
    max: { x: 0.16, y: 0.38, z: 0.08 },
  },
  {
    region: {
      id: "left-foot",
      name: "Left Foot",
      bodySystem: "musculoskeletal",
    },
    min: { x: -0.18, y: 0.0, z: -0.12 },
    max: { x: -0.05, y: 0.12, z: 0.12 },
  },
  {
    region: {
      id: "right-foot",
      name: "Right Foot",
      bodySystem: "musculoskeletal",
    },
    min: { x: 0.05, y: 0.0, z: -0.12 },
    max: { x: 0.18, y: 0.12, z: 0.12 },
  },
];

/** Check if a point is inside a bounding box. */
function isInsideBounds(point: Vector3, bounds: RegionBounds): boolean {
  return (
    point.x >= bounds.min.x &&
    point.x <= bounds.max.x &&
    point.y >= bounds.min.y &&
    point.y <= bounds.max.y &&
    point.z >= bounds.min.z &&
    point.z <= bounds.max.z
  );
}

/** Compute the center of a bounding box. */
function boundsCenter(bounds: RegionBounds): Vector3 {
  return {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
}

/** Squared distance between two points (avoids sqrt for comparison). */
function distanceSquared(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Map a 3D coordinate to a named anatomical region.
 * If the point falls inside a region's bounding box, that region is returned.
 * Otherwise, the nearest region (by center distance) is returned.
 */
export function resolve(point: Vector3): AnatomicalRegion {
  for (const entry of REGION_DATA) {
    if (isInsideBounds(point, entry)) {
      return entry.region;
    }
  }

  // Fallback: find nearest region by center distance
  let nearest = REGION_DATA[0];
  let bestDist = distanceSquared(point, boundsCenter(nearest));

  for (let i = 1; i < REGION_DATA.length; i++) {
    const dist = distanceSquared(point, boundsCenter(REGION_DATA[i]));
    if (dist < bestDist) {
      bestDist = dist;
      nearest = REGION_DATA[i];
    }
  }

  return nearest.region;
}

/**
 * Map a traced boundary to one or more anatomical regions.
 * Returns all unique regions that contain at least one boundary point,
 * falling back to nearest-region resolution for points outside all boxes.
 */
export function resolveArea(boundary: AnatomicalBoundary): AnatomicalRegion[] {
  const seen = new Set<string>();
  const result: AnatomicalRegion[] = [];

  for (const point of boundary.points) {
    const region = resolve(point);
    if (!seen.has(region.id)) {
      seen.add(region.id);
      result.push(region);
    }
  }

  return result;
}

/** Return all available anatomical regions. */
export function getAllRegions(): AnatomicalRegion[] {
  return REGION_DATA.map((entry) => entry.region);
}

/**
 * Search regions by name with case-insensitive substring matching.
 * Returns all regions whose name contains the query string.
 */
export function searchRegions(query: string): AnatomicalRegion[] {
  const lower = query.toLowerCase();
  return REGION_DATA.filter((entry) =>
    entry.region.name.toLowerCase().includes(lower)
  ).map((entry) => entry.region);
}
