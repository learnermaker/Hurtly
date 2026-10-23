import { useEffect, useRef, useState, type ReactNode } from "react";
import { intensityColor, intensityInk } from "../lib/color";
import { intensityWord } from "../lib/types";

export function IntensityScale({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="intensity">
      <div className="intensity-readout" aria-live="polite">
        <span className="intensity-num" style={{ color: intensityColor(Math.max(value, 3)) }}>{value}</span>
        <span className="intensity-word">{intensityWord(value)}</span>
      </div>
      <div className="intensity-row" role="radiogroup" aria-label="How bad is it, 0 to 10">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n}, ${intensityWord(n)}`}
            className={`intensity-step${n === value ? " is-on" : ""}`}
            style={{ background: intensityColor(n), color: intensityInk(n) }}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ChipsProps {
  options: readonly string[];
  value: string[];
  onChange: (v: string[]) => void;
  single?: boolean;
  allowCustom?: boolean;
  label: string;
}

export function Chips({ options, value, onChange, single, allowCustom, label }: ChipsProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  // Custom values (typed or from AI) show alongside the presets.
  const all = [...options, ...value.filter((v) => !options.includes(v))];

  function toggle(o: string) {
    if (single) onChange(value.includes(o) ? [] : [o]);
    else onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  }

  function commit() {
    const v = text.trim().toLowerCase();
    if (v && !value.includes(v)) onChange([...value, v]);
    setText("");
    setAdding(false);
  }

  return (
    <div className="chips" role="group" aria-label={label}>
      {all.map((o) => (
        <button key={o} type="button" className={`chip${value.includes(o) ? " is-on" : ""}`} aria-pressed={value.includes(o)} onClick={() => toggle(o)}>
          {o}
        </button>
      ))}
      {allowCustom &&
        (adding ? (
          <input
            className="chip chip-input"
            autoFocus
            value={text}
            placeholder="Type and press enter"
            aria-label={`Add to ${label}`}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setAdding(false);
            }}
          />
        ) : (
          <button type="button" className="chip chip-add" onClick={() => setAdding(true)}>
            + Other
          </button>
        ))}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <section className="field">
      <h3 className="field-label">
        {label}
        {hint && <span className="field-hint"> {hint}</span>}
      </h3>
      {children}
    </section>
  );
}

/** Bottom sheet built on <dialog>, so focus, Escape and the backdrop come for free. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="sheet-inner">
          <header className="sheet-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </header>
          <div className="sheet-body">{children}</div>
          {footer && <footer className="sheet-foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function Sparkline({ points, width = 120, height = 32 }: { points: { t: number; value: number }[]; width?: number; height?: number }) {
  if (points.length === 0) return null;
  const t0 = points[0].t;
  const span = Math.max(1, points.at(-1)!.t - t0);
  const pad = 4;
  const x = (t: number) => (points.length === 1 ? width / 2 : pad + ((t - t0) / span) * (width - pad * 2));
  const y = (v: number) => height - pad - (v / 10) * (height - pad * 2);
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} className="spark-base" />
      {points.length > 1 && <polyline points={points.map((p) => `${x(p.t)},${y(p.value)}`).join(" ")} className="spark-line" />}
      {points.map((p, i) => (
        <circle key={i} cx={x(p.t)} cy={y(p.value)} r={points.length > 20 ? 2 : 3} fill={intensityColor(p.value)} className="spark-dot" />
      ))}
    </svg>
  );
}

export function IntensityBadge({ value }: { value: number }) {
  return (
    <span className="badge" style={{ background: intensityColor(value), color: intensityInk(value) }} aria-label={`${value} out of 10`}>
      {value}
    </span>
  );
}
