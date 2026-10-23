import { useMemo, useRef, useState } from "react";
import { clearRegion, clonePaint, emptyPaint, regionsInPaint, setRegion, type Paint } from "../../lib/mask";

const UNDO_LIMIT = 40;

/**
 * The paint being drawn for a new entry, with undo. The canvas mutates the
 * paint in place while a finger moves, then calls `touched()`; every other
 * change goes through `replace()` with a fresh object.
 */
export function usePaintEditor() {
  const [paint, setPaint] = useState<Paint>(emptyPaint);
  const [version, setVersion] = useState(0);
  const undoStack = useRef<Paint[]>([]);

  const regions = useMemo(() => regionsInPaint(paint), [paint, version]);
  const painted = useMemo(() => ({ front: paint.front.some(Boolean), back: paint.back.some(Boolean) }), [paint, version]);
  const isEmpty = !painted.front && !painted.back && paint.arrows.length === 0;

  function checkpoint(before: Paint) {
    undoStack.current.push(before);
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
  }

  function touched() {
    setVersion((v) => v + 1);
  }

  function replace(next: Paint, undoable = true) {
    if (undoable) checkpoint(clonePaint(paint));
    setPaint(next);
    touched();
  }

  function undo() {
    const prev = undoStack.current.pop();
    if (prev) replace(prev, false);
  }

  function toggleRegion(id: string) {
    const next = clonePaint(paint);
    if (regions.includes(id)) clearRegion(next, id);
    else for (const v of ["front", "back"] as const) setRegion(next[v], v, id, 1);
    replace(next);
  }

  function removeRegion(id: string) {
    const next = clonePaint(paint);
    clearRegion(next, id);
    replace(next);
  }

  function reset() {
    undoStack.current = [];
    replace(emptyPaint(), false);
  }

  return { paint, regions, painted, isEmpty, canUndo: undoStack.current.length > 0, checkpoint, touched, replace, undo, toggleRegion, removeRegion, reset };
}
