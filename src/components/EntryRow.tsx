import { useState } from "react";
import type { Entry } from "../lib/types";
import { regionLabel } from "../data/regions";
import { formatTime } from "../lib/format";
import { IntensityBadge } from "./Controls";
import { db } from "../lib/db";

export function EntryRow({ entry }: { entry: Entry }) {
  const [open, setOpen] = useState(false);

  if (entry.kind === "clear") {
    return (
      <li className="entry entry-clear">
        <span className="entry-time">{formatTime(entry.createdAt)}</span>
        <span>Pain-free check-in</span>
        <button type="button" className="link link-danger" onClick={() => db.entries.delete(entry.id)}>Delete</button>
      </li>
    );
  }

  const details: [string, string][] = [
    ["Pattern", entry.pattern ?? ""],
    ["Worse with", entry.triggers.join(", ")],
    ["Better with", entry.relief.join(", ")],
    ["Gets in the way of", entry.impact.join(", ")],
    ["Note", entry.note ?? ""],
    ...entry.followUps.map((f) => [f.question, f.answer] as [string, string]),
  ].filter(([, v]) => v) as [string, string][];

  return (
    <li className="entry">
      <button type="button" className="entry-main" aria-expanded={open} onClick={() => setOpen(!open)}>
        <IntensityBadge value={entry.intensity} />
        <span className="entry-text">
          <span className="entry-regions">{entry.regions.map(regionLabel).join(", ")}</span>
          <span className="entry-sub">
            {formatTime(entry.createdAt)}
            {entry.qualities.length > 0 && ` · ${entry.qualities.join(", ")}`}
          </span>
        </span>
      </button>
      {open && (
        <div className="entry-details">
          {details.length > 0 ? (
            <dl>
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="muted">No extra detail on this entry.</p>
          )}
          <div className="row">
            <a className="btn btn-quiet" href={`#/log?repeat=${encodeURIComponent(entry.regions[0])}`}>Log again</a>
            <button
              type="button"
              className="btn btn-quiet btn-danger"
              onClick={() => {
                if (confirm("Delete this entry? This can't be undone.")) db.entries.delete(entry.id);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
