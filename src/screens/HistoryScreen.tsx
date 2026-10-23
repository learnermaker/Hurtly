import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BodyCanvas } from "../components/BodyCanvas";
import { Sparkline } from "../components/Controls";
import { EntryRow } from "../components/EntryRow";
import { RangePicker } from "../components/RangePicker";
import { allEntries } from "../lib/db";
import { dailySeries, inRange, summarizeRegions, type Trend } from "../lib/stats";
import { heatCells } from "../lib/mask";
import { dayKey, daysAgo, formatDay, relativeDays } from "../lib/format";
import { regionLabel } from "../data/regions";
import { navigate } from "../lib/route";
import type { Entry } from "../lib/types";

export const TREND_TEXT: Record<Trend, string> = {
  worse: "Getting worse",
  better: "Easing",
  steady: "Steady",
  "too few": "Too early to tell",
};

export function HistoryScreen() {
  const entries = useLiveQuery(allEntries, [], undefined as Entry[] | undefined);
  const [days, setDays] = useState(30);

  const scoped = useMemo(() => (entries ? (days ? inRange(entries, daysAgo(days)) : entries) : []), [entries, days]);
  const regions = useMemo(() => summarizeRegions(scoped), [scoped]);
  const heatFront = useMemo(() => heatCells(scoped, "front"), [scoped]);
  const heatBack = useMemo(() => heatCells(scoped, "back"), [scoped]);
  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of [...scoped].reverse()) {
      const k = dayKey(e.createdAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return [...m.values()];
  }, [scoped]);

  if (!entries) return null;

  if (entries.length === 0) {
    return (
      <div>
        <header className="screen-head"><h1>History</h1></header>
        <div className="empty">
          <p>Nothing logged yet. Your areas, trends and entries will build up here.</p>
          <a className="btn btn-primary" href="#/log">Log where it hurts</a>
        </div>
      </div>
    );
  }

  const openRegion = (id: string) => navigate(`history/region/${encodeURIComponent(id)}`);

  return (
    <div>
      <header className="screen-head">
        <h1>History</h1>
        <RangePicker value={days} onChange={setDays} />
      </header>

      <div className="figure-pair">
        <BodyCanvas view="front" heat={heatFront} onRegionTap={openRegion} label="Front view: where you've had pain, coloured by the worst intensity. Choose an area to see its history." />
        <BodyCanvas view="back" heat={heatBack} onRegionTap={openRegion} label="Back view: where you've had pain, coloured by the worst intensity. Choose an area to see its history." />
      </div>

      <section className="block">
        <h2 className="block-head">Areas</h2>
        {regions.length === 0 ? (
          <p className="muted">No pain logged in this period.</p>
        ) : (
          <ul className="areas">
            {regions.map((r) => (
              <li key={r.regionId}>
                <button type="button" className="area" onClick={() => openRegion(r.regionId)}>
                  <span className="area-text">
                    <span className="area-name">{regionLabel(r.regionId)}</span>
                    <span className="area-sub">
                      {TREND_TEXT[r.trend]} · last {relativeDays(r.last)}
                    </span>
                  </span>
                  <Sparkline points={dailySeries(scoped, r.regionId)} width={96} height={30} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="block">
        <h2 className="block-head">Entries</h2>
        {byDay.map((list) => (
          <div key={dayKey(list[0].createdAt)} className="day">
            <h3 className="day-head">{formatDay(list[0].createdAt)}</h3>
            <ul className="entries">
              {list.map((e) => <EntryRow key={e.id} entry={e} />)}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
