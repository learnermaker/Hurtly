import { shapesFor, regionLabel, type View } from "../data/regions";
import { intensityColor } from "../lib/color";

interface Props {
  view: View;
  selected?: string[];
  /** Region id → 0–10, drawn as a colour wash under the selection. */
  heat?: Record<string, number>;
  onToggle?: (regionId: string) => void;
  className?: string;
  label?: string;
}

export function BodyFigure({ view, selected = [], heat = {}, onToggle, className, label }: Props) {
  const interactive = !!onToggle;
  // Their right is on the viewer's left in front view, and on the viewer's right from behind.
  const leftMark = view === "front" ? "R" : "L";
  const rightMark = view === "front" ? "L" : "R";

  return (
    <svg
      viewBox="0 0 200 470"
      className={`figure ${className ?? ""}`}
      role={interactive ? "group" : "img"}
      aria-label={label ?? `Body, ${view} view`}
    >
      <text x="14" y="30" className="figure-side" aria-hidden="true">{leftMark}</text>
      <text x="186" y="30" className="figure-side" textAnchor="end" aria-hidden="true">{rightMark}</text>
      {shapesFor(view).map((s) => {
        const isSel = selected.includes(s.regionId);
        const h = heat[s.regionId];
        const name = regionLabel(s.regionId);
        return (
          <path
            key={s.regionId}
            d={s.d}
            className={`region${isSel ? " is-selected" : ""}${h !== undefined ? " has-heat" : ""}`}
            style={h !== undefined ? { fill: intensityColor(h) } : undefined}
            {...(interactive
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": name,
                  "aria-pressed": isSel,
                  onClick: () => onToggle!(s.regionId),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggle!(s.regionId);
                    }
                  },
                }
              : {})}
          >
            <title>{h !== undefined ? `${name}: ${h}/10` : name}</title>
          </path>
        );
      })}
    </svg>
  );
}
