import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { allEntries } from "../lib/db";
import { dailySeries, summarizeRegions } from "../lib/stats";
import { formatDate, relativeDays } from "../lib/format";
import { regionLabel } from "../data/regions";
import { intensityColor } from "../lib/color";
import { EntryRow } from "../components/EntryRow";
import { TREND_TEXT } from "./HistoryScreen";
import type { Entry } from "../lib/types";

export function RegionScreen({ regionId }: { regionId: string }) {
  const entries = useLiveQuery(allEntries, [], undefined as Entry[] | undefined);
  const mine = useMemo(() => (entries ?? []).filter((e) => e.kind === "pain" && e.regions.includes(regionId)), [entries, regionId]);
  const summary = useMemo(() => summarizeRegions(mine).find((s) => s.regionId === regionId), [mine, regionId]);
  const series = useMemo(() => dailySeries(mine, regionId), [mine, regionId]);

  if (!entries) return null;

  return (
    <div>
      <header className="screen-head screen-head-back">
        <a href="#/history" className="back" aria-label="Back to history">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
        <h1>{regionLabel(regionId)}</h1>
      </header>

      {!summary ? (
        <div className="empty">
          <p>No pain logged here yet.</p>
          <a className="btn btn-primary" href={`#/log?repeat=${encodeURIComponent(regionId)}`}>Log this area</a>
        </div>
      ) : (
        <>
          <dl className="stats">
            <div><dt>First noticed</dt><dd>{formatDate(summary.first)}</dd></div>
            <div><dt>Last logged</dt><dd>{relativeDays(summary.last)}</dd></div>
            <div><dt>Typical</dt><dd>{summary.average}/10</dd></div>
            <div><dt>Worst</dt><dd>{summary.peak}/10</dd></div>
          </dl>

          <section className="block">
            <h2 className="block-head">{TREND_TEXT[summary.trend]}</h2>
            <TrendChart points={series} />
          </section>

          {(summary.qualities.length > 0 || summary.triggers.length > 0 || summary.relief.length > 0) && (
            <section className="block">
              <dl className="facts">
                {summary.qualities.length > 0 && <div><dt>Usually feels</dt><dd>{summary.qualities.join(", ")}</dd></div>}
                {summary.triggers.length > 0 && <div><dt>Worse with</dt><dd>{summary.triggers.join(", ")}</dd></div>}
                {summary.relief.length > 0 && <div><dt>Better with</dt><dd>{summary.relief.join(", ")}</dd></div>}
              </dl>
            </section>
          )}

          <a className="btn btn-primary btn-wide" href={`#/log?repeat=${encodeURIComponent(regionId)}`}>Log it again</a>

          <section className="block">
            <h2 className="block-head">{summary.count} {summary.count === 1 ? "entry" : "entries"}</h2>
            <ul className="entries">
              {[...mine].reverse().map((e) => <EntryRow key={e.id} entry={e} />)}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function TrendChart({ points }: { points: { t: number; value: number }[] }) {
  const W = 320, H = 150, L = 26, R = 8, T = 10, B = 24;
  const t0 = points[0]?.t ?? 0;
  const span = Math.max(1, (points.at(-1)?.t ?? 0) - t0);
  const x = (t: number) => (points.length === 1 ? (L + W - R) / 2 : L + ((t - t0) / span) * (W - L - R));
  const y = (v: number) => T + (1 - v / 10) * (H - T - B);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Daily worst intensity, ${points.length} days`}>
      {[0, 5, 10].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="chart-grid" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" className="chart-label">{v}</text>
        </g>
      ))}
      {points.length > 1 && <polyline points={points.map((p) => `${x(p.t)},${y(p.value)}`).join(" ")} className="chart-line" />}
      {points.map((p) => (
        <circle key={p.t} cx={x(p.t)} cy={y(p.value)} r={4} fill={intensityColor(p.value)} className="spark-dot"><title>{`${formatDate(p.t)}: ${p.value}/10`}</title></circle>
      ))}
      {points.length > 0 && (
        <>
          <text x={L} y={H - 6} className="chart-label">{formatDate(points[0].t)}</text>
          {points.length > 1 && <text x={W - R} y={H - 6} textAnchor="end" className="chart-label">{formatDate(points.at(-1)!.t)}</text>}
        </>
      )}
    </svg>
  );
}
