import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { shapesFor, regionLabel, type View } from "../data/regions";
import { brushLine, CELL, COLS, H, ROWS, W, clonePaint, regionAt, type Arrow, type Paint } from "../lib/mask";
import { intensityColor } from "../lib/color";

export type Tool = "paint" | "erase" | "arrow";

interface Props {
  view: View;
  /** Per-cell intensity (−1 = none) drawn as a wash: faint while editing, full when viewing. */
  heat?: Int8Array;
  label: string;
  className?: string;

  /** Editing: the paint is mutated in place; onChange fires after every change. */
  paint?: Paint;
  tool?: Tool;
  onStrokeStart?: (before: Paint) => void;
  onChange?: () => void;
  /** Keyboard alternative to painting: toggles a whole region. */
  onRegionToggle?: (regionId: string) => void;
  /** Highlighted regions (keyboard state and screen readers). */
  selected?: string[];

  /** Viewing: tapping the figure reports which region was tapped. */
  onRegionTap?: (regionId: string) => void;
  arrows?: Arrow[];
}

interface Zoom {
  s: number;
  x: number;
  y: number;
}

const MAX_ZOOM = 5;
const BRUSH = 9;

function clampZoom(z: Zoom): Zoom {
  const s = Math.min(MAX_ZOOM, Math.max(1, z.s));
  return { s, x: Math.min(W - W / s, Math.max(0, z.x)), y: Math.min(H - H / s, Math.max(0, z.y)) };
}

export function BodyCanvas(props: Props) {
  const { view, heat, label, className, paint, tool = "paint", onStrokeStart, onChange, onRegionToggle, selected = [], onRegionTap, arrows } = props;
  const editing = !!paint;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState<Zoom>({ s: 1, x: 0, y: 0 });
  const [draftArrow, setDraftArrow] = useState<Arrow | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const shapes = useMemo(() => shapesFor(view), [view]);
  const vb = `${zoom.x} ${zoom.y} ${W / zoom.s} ${H / zoom.s}`;

  // Reset zoom when turning the figure around.
  useEffect(() => setZoom({ s: 1, x: 0, y: 0 }), [view]);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(size.w * dpr)) c.width = Math.round(size.w * dpr);
    if (c.height !== Math.round(size.h * dpr)) c.height = Math.round(size.h * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const k = (size.w / W) * zoom.s * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(k, 0, 0, k, -zoom.x * k, -zoom.y * k);
    if ("filter" in ctx) ctx.filter = `blur(${Math.max(1, CELL * 0.45 * k)}px)`;

    const dot = (p: Path2D, i: number) => {
      const x = ((i % COLS) + 0.5) * CELL;
      const y = (Math.floor(i / COLS) + 0.5) * CELL;
      p.moveTo(x + CELL * 0.85, y);
      p.arc(x, y, CELL * 0.85, 0, Math.PI * 2);
    };

    if (heat) {
      // One path per intensity level keeps this to at most 11 fills.
      const byLevel: Path2D[] = [];
      for (let i = 0; i < ROWS * COLS; i++) {
        const v = heat[i];
        if (v < 0) continue;
        (byLevel[v] ??= new Path2D()), dot(byLevel[v], i);
      }
      ctx.globalAlpha = editing ? 0.35 : 1;
      byLevel.forEach((p, v) => {
        if (!p) return;
        ctx.fillStyle = intensityColor(v);
        ctx.fill(p);
      });
      ctx.globalAlpha = 1;
    }

    if (paint) {
      const m = paint[view];
      const p = new Path2D();
      let any = false;
      for (let i = 0; i < m.length; i++) if (m[i]) (dot(p, i), (any = true));
      if (any) {
        ctx.fillStyle = getComputedStyle(c).getPropertyValue("--paint").trim() || "#17656a";
        ctx.fill(p);
      }
    }
  }, [heat, paint, view, zoom, size, editing]);

  useEffect(draw, [draw]);

  // ---------- Pointer handling ----------

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const stroke = useRef<{ last: [number, number]; before: Paint; moved: boolean } | null>(null);
  const pinch = useRef<{ d0: number; z0: Zoom; mid: [number, number] } | null>(null);
  const tapStart = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef(0);

  const toVB = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const r = wrap.current!.getBoundingClientRect();
      return [zoom.x + ((clientX - r.left) / r.width) * (W / zoom.s), zoom.y + ((clientY - r.top) / r.height) * (H / zoom.s)];
    },
    [zoom],
  );

  function redrawSoon() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      draw();
      onChange?.();
    });
  }

  function startPinch() {
    const [a, b] = [...pointers.current.values()];
    const r = wrap.current!.getBoundingClientRect();
    const midClient = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    pinch.current = {
      d0: Math.hypot(a.x - b.x, a.y - b.y),
      z0: zoom,
      // Fraction of the box under the fingers' midpoint, so it stays put while zooming.
      mid: [(midClient[0] - r.left) / r.width, (midClient[1] - r.top) / r.height],
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    wrap.current!.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (!editing) {
      tapStart.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (pointers.current.size === 2) {
      // A second finger means zoom/pan: undo whatever the first finger just started.
      if (stroke.current && paint) {
        const b = stroke.current.before;
        paint.front.set(b.front);
        paint.back.set(b.back);
        paint.arrows = b.arrows;
        redrawSoon();
      }
      stroke.current = null;
      setDraftArrow(null);
      startPinch();
      return;
    }
    if (pointers.current.size > 2) return;
    const pt = toVB(e.clientX, e.clientY);
    const before = clonePaint(paint!);
    stroke.current = { last: pt, before, moved: false };
    if (tool === "arrow") {
      setDraftArrow({ view, from: pt, to: pt });
      return;
    }
    onStrokeStart?.(before);
    if (brushLine(paint![view], view, pt, pt, BRUSH / zoom.s, tool === "erase" ? 0 : 1)) redrawSoon();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const { d0, z0, mid } = pinch.current;
      const s = Math.min(MAX_ZOOM, Math.max(1, z0.s * (Math.hypot(a.x - b.x, a.y - b.y) / d0)));
      const r = wrap.current!.getBoundingClientRect();
      const midNow = [((a.x + b.x) / 2 - r.left) / r.width, ((a.y + b.y) / 2 - r.top) / r.height];
      const anchor = [z0.x + mid[0] * (W / z0.s), z0.y + mid[1] * (H / z0.s)];
      setZoom(clampZoom({ s, x: anchor[0] - midNow[0] * (W / s), y: anchor[1] - midNow[1] * (H / s) }));
      return;
    }
    const st = stroke.current;
    if (!editing || !st) return;
    const pt = toVB(e.clientX, e.clientY);
    st.moved = true;
    if (tool === "arrow") {
      setDraftArrow({ view, from: st.last, to: pt });
      return;
    }
    if (brushLine(paint![view], view, st.last, pt, BRUSH / zoom.s, tool === "erase" ? 0 : 1)) redrawSoon();
    if (tool === "erase") eraseArrowsNear(pt);
    st.last = pt;
  }

  function eraseArrowsNear([x, y]: [number, number]) {
    if (!paint) return;
    const r = (BRUSH * 1.5) / zoom.s;
    const keep = paint.arrows.filter((a) => a.view !== view || distToSegment(x, y, a) > r);
    if (keep.length !== paint.arrows.length) {
      paint.arrows = keep;
      redrawSoon();
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const had = pointers.current.delete(e.pointerId);
    if (!had) return;
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    if (!editing) {
      const t = tapStart.current;
      tapStart.current = null;
      if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 10) {
        const [x, y] = toVB(e.clientX, e.clientY);
        const id = regionAt(view, x, y);
        if (id) onRegionTap?.(id);
      }
      return;
    }
    const st = stroke.current;
    stroke.current = null;
    if (!st) return;
    if (tool === "arrow" && draftArrow) {
      setDraftArrow(null);
      const len = Math.hypot(draftArrow.to[0] - draftArrow.from[0], draftArrow.to[1] - draftArrow.from[1]);
      if (len * zoom.s > 12) {
        onStrokeStart?.(st.before);
        paint!.arrows = [...paint!.arrows, draftArrow];
        redrawSoon();
      }
    } else if (tool === "erase" && !st.moved) {
      eraseArrowsNear(st.last);
    }
  }

  function onWheel(e: React.WheelEvent) {
    if (!editing) return;
    const [ax, ay] = toVB(e.clientX, e.clientY);
    const s = Math.min(MAX_ZOOM, Math.max(1, zoom.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const fx = (ax - zoom.x) / (W / zoom.s);
    const fy = (ay - zoom.y) / (H / zoom.s);
    setZoom(clampZoom({ s, x: ax - fx * (W / s), y: ay - fy * (H / s) }));
  }

  function zoomBy(f: number) {
    const cx = zoom.x + W / zoom.s / 2;
    const cy = zoom.y + H / zoom.s / 2;
    const s = Math.min(MAX_ZOOM, Math.max(1, zoom.s * f));
    setZoom(clampZoom({ s, x: cx - W / s / 2, y: cy - H / s / 2 }));
  }

  // Keep the page from scrolling while a finger paints.
  useEffect(() => {
    const el = wrap.current;
    if (!el || !editing) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, [editing]);

  const shownArrows = [...(paint?.arrows ?? arrows ?? []), ...(draftArrow ? [draftArrow] : [])].filter((a) => a.view === view);
  const leftMark = view === "front" ? "R" : "L";
  const rightMark = view === "front" ? "L" : "R";
  const markerId = `arrowhead-${view}-${editing ? "e" : "v"}`;

  return (
    <div className={`bodyc${editing ? " bodyc--edit" : ""} ${className ?? ""}`}>
      <div
        ref={wrap}
        className="bodyc-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        data-tool={editing ? tool : undefined}
      >
        <svg className="bodyc-layer" viewBox={vb} aria-hidden="true">
          <g className="silhouette">
            {shapes.map((s) => <path key={s.regionId} d={s.d} />)}
          </g>
        </svg>
        <canvas ref={canvas} className="bodyc-layer bodyc-canvas" />
        <svg className="bodyc-layer bodyc-over" viewBox={vb} role="group" aria-label={label}>
          <defs>
            <marker id={markerId} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" className="arrowhead" />
            </marker>
          </defs>
          {shapes.map((s) => {
            const on = selected.includes(s.regionId);
            const name = regionLabel(s.regionId);
            const interactive = editing ? onRegionToggle : onRegionTap;
            return (
              <path
                key={s.regionId}
                d={s.d}
                className={`seam${on ? " is-on" : ""}`}
                {...(interactive
                  ? {
                      role: "button",
                      tabIndex: 0,
                      "aria-label": name,
                      ...(editing ? { "aria-pressed": on } : {}),
                      onKeyDown: (e: React.KeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          interactive(s.regionId);
                        }
                      },
                    }
                  : {})}
              />
            );
          })}
          {shownArrows.map((a, i) => (
            <line
              key={i}
              x1={a.from[0]}
              y1={a.from[1]}
              x2={a.to[0]}
              y2={a.to[1]}
              className="spread"
              style={{ strokeWidth: 2.4 / zoom.s }}
              markerEnd={`url(#${markerId})`}
            />
          ))}
        </svg>
        <span className="bodyc-side bodyc-side-l" aria-hidden="true">{leftMark}</span>
        <span className="bodyc-side bodyc-side-r" aria-hidden="true">{rightMark}</span>
      </div>
      {editing && (
        <div className="zoom" role="group" aria-label="Zoom">
          <button type="button" className="zoom-btn" onClick={() => zoomBy(1.6)} disabled={zoom.s >= MAX_ZOOM} aria-label="Zoom in">+</button>
          <button type="button" className="zoom-btn" onClick={() => zoomBy(1 / 1.6)} disabled={zoom.s <= 1} aria-label="Zoom out">−</button>
          {zoom.s > 1 && (
            <button type="button" className="zoom-btn zoom-reset" onClick={() => setZoom({ s: 1, x: 0, y: 0 })} aria-label="Show whole body">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function distToSegment(x: number, y: number, a: Arrow): number {
  const [x1, y1] = a.from;
  const [x2, y2] = a.to;
  const len2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / len2));
  return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1)));
}
