import { useRef, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type {
  PainMarker,
  AnatomicalLocation,
  AnatomicalBoundary,
} from "@bodytrace/shared";
import { resolve, resolveArea, getAllRegions } from "../services/anatomical-region-mapper";

// --- Exported Utility Functions ---

/**
 * Map a pain intensity value (0–10) to a hex color string.
 * Gradient: green (0) → yellow (5) → red (10).
 */
export function intensityToColor(intensity: number): string {
  const clamped = Math.max(0, Math.min(10, intensity));
  const t = clamped / 10;

  let r: number;
  let g: number;

  if (t <= 0.5) {
    // Green to Yellow (0–5)
    r = Math.round(255 * (t * 2));
    g = 255;
  } else {
    // Yellow to Red (5–10)
    r = 255;
    g = Math.round(255 * (1 - (t - 0.5) * 2));
  }

  const rHex = r.toString(16).padStart(2, "0");
  const gHex = g.toString(16).padStart(2, "0");
  return `#${rHex}${gHex}00`;
}

/**
 * Classify a marker's visual recency based on its status field.
 * - "active" markers are fully opaque
 * - "resolved" markers are semi-transparent
 * - "historical" markers are more transparent
 */
export function classifyRecency(
  marker: PainMarker
): "active" | "resolved" | "historical" {
  return marker.status;
}

// --- Component ---

export interface BodyModelRendererProps {
  markers?: PainMarker[];
  onPointSelect?: (location: AnatomicalLocation) => void;
  onAreaTrace?: (boundary: AnatomicalBoundary) => void;
  showBodyMap?: boolean;
  enableKeyboardNavigation?: boolean;
}

const OPACITY_MAP: Record<"active" | "resolved" | "historical", number> = {
  active: 1.0,
  resolved: 0.5,
  historical: 0.25,
};

/** Build a simplified human body from basic geometries. */
function buildBodyModel(): THREE.Group {
  const body = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0xd2a679,
    roughness: 0.7,
    metalness: 0.1,
  });

  const parts: { geo: THREE.BufferGeometry; pos: [number, number, number] }[] =
    [
      // Head
      { geo: new THREE.SphereGeometry(0.12, 16, 16), pos: [0, 1.72, 0] },
      // Neck
      {
        geo: new THREE.CylinderGeometry(0.05, 0.06, 0.15, 12),
        pos: [0, 1.52, 0],
      },
      // Torso
      {
        geo: new THREE.CylinderGeometry(0.18, 0.16, 0.55, 16),
        pos: [0, 1.07, 0],
      },
      // Hips / pelvis
      {
        geo: new THREE.CylinderGeometry(0.16, 0.14, 0.12, 16),
        pos: [0, 0.77, 0],
      },
      // Left upper arm
      {
        geo: new THREE.CylinderGeometry(0.045, 0.04, 0.28, 10),
        pos: [-0.28, 1.18, 0],
      },
      // Right upper arm
      {
        geo: new THREE.CylinderGeometry(0.045, 0.04, 0.28, 10),
        pos: [0.28, 1.18, 0],
      },
      // Left forearm
      {
        geo: new THREE.CylinderGeometry(0.04, 0.035, 0.28, 10),
        pos: [-0.28, 0.9, 0],
      },
      // Right forearm
      {
        geo: new THREE.CylinderGeometry(0.04, 0.035, 0.28, 10),
        pos: [0.28, 0.9, 0],
      },
      // Left hand
      {
        geo: new THREE.SphereGeometry(0.04, 10, 10),
        pos: [-0.28, 0.74, 0],
      },
      // Right hand
      {
        geo: new THREE.SphereGeometry(0.04, 10, 10),
        pos: [0.28, 0.74, 0],
      },
      // Left thigh
      {
        geo: new THREE.CylinderGeometry(0.07, 0.06, 0.35, 12),
        pos: [-0.1, 0.55, 0],
      },
      // Right thigh
      {
        geo: new THREE.CylinderGeometry(0.07, 0.06, 0.35, 12),
        pos: [0.1, 0.55, 0],
      },
      // Left shin
      {
        geo: new THREE.CylinderGeometry(0.055, 0.045, 0.3, 12),
        pos: [-0.1, 0.25, 0],
      },
      // Right shin
      {
        geo: new THREE.CylinderGeometry(0.055, 0.045, 0.3, 12),
        pos: [0.1, 0.25, 0],
      },
      // Left foot
      {
        geo: new THREE.BoxGeometry(0.08, 0.06, 0.14),
        pos: [-0.1, 0.05, 0.02],
      },
      // Right foot
      {
        geo: new THREE.BoxGeometry(0.08, 0.06, 0.14),
        pos: [0.1, 0.05, 0.02],
      },
    ];

  for (const { geo, pos } of parts) {
    const mesh = new THREE.Mesh(geo, material.clone());
    mesh.position.set(...pos);
    mesh.userData.isBodyPart = true;
    body.add(mesh);
  }

  return body;
}

/** Create a visual marker sphere at a 3D position. */
function createMarkerMesh(
  position: THREE.Vector3,
  color: string,
  opacity: number
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.025, 12, 12);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    transparent: opacity < 1,
    opacity,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.3,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  return mesh;
}

/** Create a visual focus indicator (outline) at a 3D position. */
function createFocusIndicator(position: THREE.Vector3): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.04, 16, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.6,
    wireframe: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(position);
  return mesh;
}

/** Get the center position of a region by its ID. */
function getRegionCenter(regionId: string): THREE.Vector3 {
  // Map region IDs to approximate center positions on the body model
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

  const coords = regionCenters[regionId] || [0, 1, 0];
  return new THREE.Vector3(...coords);
}

export default function BodyModelRenderer({
  markers = [],
  onPointSelect,
  onAreaTrace,
  showBodyMap = false,
  enableKeyboardNavigation = true,
}: BodyModelRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const bodyRef = useRef<THREE.Group | null>(null);
  const markerGroupRef = useRef<THREE.Group | null>(null);
  const focusIndicatorRef = useRef<THREE.Mesh | null>(null);
  const dragPointsRef = useRef<THREE.Vector3[]>([]);
  const isDraggingRef = useRef(false);
  const animFrameRef = useRef<number>(0);

  // Keyboard navigation state
  const [focusedRegionIndex, setFocusedRegionIndex] = useState<number>(-1);
  const [availableRegions] = useState(() => getAllRegions());
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);

  // Raycasting helper
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());

  const getIntersection = useCallback(
    (event: MouseEvent): THREE.Intersection | null => {
      const container = containerRef.current;
      const camera = cameraRef.current;
      const body = bodyRef.current;
      if (!container || !camera || !body) return null;

      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y =
        -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(
        body.children,
        true
      );
      return intersects.length > 0 ? intersects[0] : null;
    },
    []
  );

  // Render markers onto the scene
  const renderMarkers = useCallback(
    (painMarkers: PainMarker[]) => {
      const markerGroup = markerGroupRef.current;
      if (!markerGroup) return;

      // Clear existing markers
      while (markerGroup.children.length > 0) {
        const child = markerGroup.children[0];
        markerGroup.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      }

      for (const marker of painMarkers) {
        const color = intensityToColor(marker.intensity);
        const recency = classifyRecency(marker);
        const opacity = showBodyMap ? OPACITY_MAP[recency] : 1.0;
        const coords = marker.location.coordinates;
        const pos = new THREE.Vector3(coords.x, coords.y, coords.z);
        const mesh = createMarkerMesh(pos, color, opacity);
        markerGroup.add(mesh);

        // If area marker, draw boundary line
        if (marker.boundary && marker.boundary.points.length > 1) {
          const linePoints = marker.boundary.points.map(
            (p) => new THREE.Vector3(p.x, p.y, p.z)
          );
          linePoints.push(linePoints[0]); // close the loop
          const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
          const lineMat = new THREE.LineBasicMaterial({
            color: new THREE.Color(color),
            transparent: opacity < 1,
            opacity,
          });
          const line = new THREE.Line(lineGeo, lineMat);
          markerGroup.add(line);
        }
      }
    },
    [showBodyMap]
  );

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1, 2.5);
    camera.lookAt(0, 0.9, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls (rotate, zoom, pan)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.9, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 1;
    controls.maxDistance = 5;
    controls.update();
    controlsRef.current = controls;

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(2, 3, 2);
    scene.add(directional);
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(-1, 2, -2);
    scene.add(backLight);

    // Body model
    const body = buildBodyModel();
    scene.add(body);
    bodyRef.current = body;

    // Marker group
    const markerGroup = new THREE.Group();
    scene.add(markerGroup);
    markerGroupRef.current = markerGroup;

    // Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update markers when props change
  useEffect(() => {
    renderMarkers(markers);
  }, [markers, renderMarkers]);

  // Update focus indicator when focused region changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !enableKeyboardNavigation) return;

    // Remove existing focus indicator
    if (focusIndicatorRef.current) {
      scene.remove(focusIndicatorRef.current);
      focusIndicatorRef.current.geometry.dispose();
      (focusIndicatorRef.current.material as THREE.Material).dispose();
      focusIndicatorRef.current = null;
    }

    // Add new focus indicator if a region is focused
    if (focusedRegionIndex >= 0 && focusedRegionIndex < availableRegions.length) {
      const region = availableRegions[focusedRegionIndex];
      const position = getRegionCenter(region.id);
      const indicator = createFocusIndicator(position);
      scene.add(indicator);
      focusIndicatorRef.current = indicator;
    }
  }, [focusedRegionIndex, availableRegions, enableKeyboardNavigation]);

  // Keyboard navigation handler
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enableKeyboardNavigation || !onPointSelect) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keyboard navigation when in keyboard mode or when Tab is pressed
      if (e.key === "Tab") {
        e.preventDefault();
        setIsKeyboardMode(true);
        if (focusedRegionIndex === -1) {
          setFocusedRegionIndex(0);
        }
        return;
      }

      if (!isKeyboardMode && focusedRegionIndex === -1) return;

      switch (e.key) {
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          setIsKeyboardMode(true);

          let newIndex = focusedRegionIndex;

          if (focusedRegionIndex === -1) {
            // Start navigation
            newIndex = 0;
          } else {
            // Navigate through regions
            if (e.key === "ArrowDown" || e.key === "ArrowRight") {
              newIndex = (focusedRegionIndex + 1) % availableRegions.length;
            } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
              newIndex =
                (focusedRegionIndex - 1 + availableRegions.length) %
                availableRegions.length;
            }
          }

          setFocusedRegionIndex(newIndex);
          break;
        }

        case "Enter":
        case " ": {
          e.preventDefault();
          if (focusedRegionIndex >= 0 && focusedRegionIndex < availableRegions.length) {
            const region = availableRegions[focusedRegionIndex];
            const position = getRegionCenter(region.id);
            const location: AnatomicalLocation = {
              region,
              coordinates: { x: position.x, y: position.y, z: position.z },
            };
            onPointSelect(location);
          }
          break;
        }

        case "Escape": {
          e.preventDefault();
          setIsKeyboardMode(false);
          setFocusedRegionIndex(-1);
          break;
        }
      }
    };

    const handleMouseDown = () => {
      // Exit keyboard mode when user clicks
      setIsKeyboardMode(false);
      setFocusedRegionIndex(-1);
    };

    container.addEventListener("keydown", handleKeyDown);
    container.addEventListener("mousedown", handleMouseDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      container.removeEventListener("mousedown", handleMouseDown);
    };
  }, [
    enableKeyboardNavigation,
    onPointSelect,
    focusedRegionIndex,
    availableRegions,
    isKeyboardMode,
  ]);

  // Click handler — place a point Pain Marker
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onPointSelect) return;

    let pointerDownPos: { x: number; y: number } | null = null;

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
      dragPointsRef.current = [];
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDownPos) return;
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        isDraggingRef.current = true;
        // Collect drag points for area tracing
        const hit = getIntersection(e as unknown as MouseEvent);
        if (hit) {
          dragPointsRef.current.push(hit.point.clone());
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDraggingRef.current && onAreaTrace && dragPointsRef.current.length > 2) {
        // Area trace completed
        const points = dragPointsRef.current.map((p) => ({
          x: p.x,
          y: p.y,
          z: p.z,
        }));
        const regions = resolveArea({ regions: [], points });
        const boundary: AnatomicalBoundary = { regions, points };
        onAreaTrace(boundary);
      } else if (!isDraggingRef.current) {
        // Single click — point marker
        const hit = getIntersection(e as unknown as MouseEvent);
        if (hit) {
          const coords = {
            x: hit.point.x,
            y: hit.point.y,
            z: hit.point.z,
          };
          const region = resolve(coords);
          const location: AnatomicalLocation = {
            region,
            coordinates: coords,
          };
          onPointSelect(location);
        }
      }

      pointerDownPos = null;
      isDraggingRef.current = false;
      dragPointsRef.current = [];
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointSelect, onAreaTrace, getIntersection]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={
        enableKeyboardNavigation
          ? "3D Body Model - Click to place pain markers, drag to trace areas. Press Tab to enter keyboard navigation mode, use arrow keys to navigate regions, Enter or Space to select."
          : "3D Body Model - Click to place pain markers, drag to trace areas"
      }
      aria-describedby={
        isKeyboardMode && focusedRegionIndex >= 0
          ? `focused-region-${focusedRegionIndex}`
          : undefined
      }
      tabIndex={enableKeyboardNavigation ? 0 : -1}
      style={{ width: "100%", height: "100%", minHeight: 400, outline: "none" }}
    >
      {isKeyboardMode && focusedRegionIndex >= 0 && (
        <div
          id={`focused-region-${focusedRegionIndex}`}
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "8px 12px",
            borderRadius: 4,
            fontSize: 14,
            zIndex: 1000,
            pointerEvents: "none",
          }}
          role="status"
          aria-live="polite"
        >
          Focused: {availableRegions[focusedRegionIndex].name}
        </div>
      )}
    </div>
  );
}
