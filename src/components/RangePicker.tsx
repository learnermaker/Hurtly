const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 0, label: "All" },
];

export function RangePicker({ value, onChange }: { value: number; onChange: (d: number) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label="Time range">
      {RANGES.map((r) => (
        <button key={r.days} type="button" role="radio" aria-checked={value === r.days} className={`seg-btn${value === r.days ? " is-on" : ""}`} onClick={() => onChange(r.days)}>
          {r.label}
        </button>
      ))}
    </div>
  );
}
