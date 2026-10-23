import { useState } from "react";
import { Sheet } from "../../components/Controls";
import { REGIONS } from "../../data/regions";

interface Props {
  open: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}

export function FindSheet({ open, selected, onToggle, onClose }: Props) {
  const [q, setQ] = useState("");
  const matches = REGIONS.filter((r) => r.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Sheet open={open} onClose={onClose} title="Find an area" footer={<button type="button" className="btn btn-primary btn-wide" onClick={onClose}>Done</button>}>
      <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Knee, shoulder, back…" aria-label="Search body areas" autoFocus />
      <ul className="find-list">
        {matches.map((r) => (
          <li key={r.id}>
            <label className="check">
              <input type="checkbox" checked={selected.includes(r.id)} onChange={() => onToggle(r.id)} />
              <span>{r.label}</span>
            </label>
          </li>
        ))}
        {matches.length === 0 && <li className="muted">No area called "{q}". Try a broader word, like "arm" or "back".</li>}
      </ul>
    </Sheet>
  );
}
