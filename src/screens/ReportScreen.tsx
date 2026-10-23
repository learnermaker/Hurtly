import { useMemo, useState } from "react";
import { BodyCanvas } from "../components/BodyCanvas";
import { RangePicker } from "../components/RangePicker";
import { useRecentEntries } from "../lib/hooks";
import { TREND_LABEL, overview, summarizeRegions } from "../lib/stats";
import { heatCells, paintOf } from "../lib/mask";
import { daysAgo, errorText, formatDate } from "../lib/format";
import { regionLabel } from "../data/regions";
import { aiReady, useSettings } from "../lib/settings";
import { writeSummary, type Narrative } from "../lib/ai";
import { download, toCsv } from "../lib/export";

export function ReportScreen() {
  const settings = useSettings();
  const [days, setDays] = useState(30);
  const { all: entries, scoped } = useRecentEntries(days);
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regions = useMemo(() => summarizeRegions(scoped), [scoped]);
  const stats = useMemo(() => overview(scoped), [scoped]);
  const heatFront = useMemo(() => heatCells(scoped, "front"), [scoped]);
  const heatBack = useMemo(() => heatCells(scoped, "back"), [scoped]);
  const arrows = useMemo(() => scoped.flatMap((e) => (e.kind === "pain" ? paintOf(e).arrows : [])), [scoped]);
  const notes = useMemo(() => scoped.filter((e) => e.kind === "pain" && (e.note || e.followUps.length)).slice(-8).reverse(), [scoped]);

  if (!entries) return null;

  const from = days ? daysAgo(days) : scoped[0]?.createdAt ?? Date.now();
  const to = Date.now();

  async function summarize() {
    setBusy(true);
    setError(null);
    try {
      setNarrative(await writeSummary({ from, to }, stats, regions, scoped));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function changeRange(d: number) {
    setDays(d);
    setNarrative(null);
  }

  return (
    <div>
      <header className="screen-head no-print">
        <h1>Report</h1>
        <RangePicker value={days} onChange={changeRange} />
      </header>

      {scoped.length === 0 ? (
        <div className="empty">
          <p>Nothing logged in this period, so there's nothing to report yet.</p>
          <a className="btn btn-primary" href="#/log">Log where it hurts</a>
        </div>
      ) : (
        <>
          <p className="muted no-print">A one-page summary to show a doctor, physio or anyone helping with your care.</p>

          <article className="report">
            <header className="report-head">
              <h2>Pain history</h2>
              <p>{formatDate(from)} – {formatDate(to)}</p>
            </header>

            <dl className="stats">
              <div><dt>Days logged</dt><dd>{stats.daysLogged}</dd></div>
              <div><dt>Days with pain</dt><dd>{stats.painDays}</dd></div>
              <div><dt>Pain-free check-ins</dt><dd>{stats.painFreeDays}</dd></div>
              <div><dt>Areas</dt><dd>{regions.length}</dd></div>
            </dl>

            {narrative ? (
              <section className="narrative">
                <h3>Summary</h3>
                <p>{narrative.overview}</p>
                {narrative.keyPoints.length > 0 && <ul>{narrative.keyPoints.map((k) => <li key={k}>{k}</li>)}</ul>}
                <p className="fine">Written by AI from the entries below. Check it says what you mean before sharing.</p>
              </section>
            ) : (
              aiReady(settings) && (
                <div className="no-print">
                  <button type="button" className="btn btn-quiet btn-wide" onClick={summarize} disabled={busy}>
                    {busy ? "Writing…" : "Add a written summary"}
                  </button>
                  {error && <p className="error" role="alert">{error}</p>}
                </div>
              )
            )}

            <div className="figure-pair figure-pair-report">
              <BodyCanvas view="front" heat={heatFront} arrows={arrows} label="Front view: painted pain areas, coloured by worst intensity" />
              <BodyCanvas view="back" heat={heatBack} arrows={arrows} label="Back view: painted pain areas, coloured by worst intensity" />
            </div>

            {regions.length > 0 && (
              <table className="report-table">
                <thead>
                  <tr><th>Area</th><th>Entries</th><th>Typical</th><th>Worst</th><th>Direction</th><th>First noticed</th></tr>
                </thead>
                <tbody>
                  {regions.map((r) => (
                    <tr key={r.regionId}>
                      <th scope="row">
                        {regionLabel(r.regionId)}
                        {r.qualities.length > 0 && <span className="cell-sub">{r.qualities.join(", ")}</span>}
                        {r.triggers.length > 0 && <span className="cell-sub">Worse with {r.triggers.join(", ")}</span>}
                        {r.relief.length > 0 && <span className="cell-sub">Better with {r.relief.join(", ")}</span>}
                      </th>
                      <td>{r.count}</td>
                      <td>{r.average}</td>
                      <td>{r.peak}</td>
                      <td>{TREND_LABEL[r.trend]}</td>
                      <td>{formatDate(r.first)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {notes.length > 0 && (
              <section>
                <h3>In my words</h3>
                <ul className="report-notes">
                  {notes.map((e) => (
                    <li key={e.id}>
                      <strong>{formatDate(e.createdAt)}, {e.regions.map(regionLabel).join(", ")}:</strong>{" "}
                      {[e.note, ...e.followUps.map((f) => `${f.question} ${f.answer}`)].filter(Boolean).map((t) => (/[.!?]$/.test(t!) ? t : `${t}.`)).join(" ")}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {narrative && narrative.questionsToAsk.length > 0 && (
              <section>
                <h3>Questions I'd like to ask</h3>
                <ul>{narrative.questionsToAsk.map((q) => <li key={q}>{q}</li>)}</ul>
              </section>
            )}

            <p className="fine">Self-reported in BodyTrace. Intensity is on a 0–10 scale, where 10 is the worst imaginable. This is a personal record, not a diagnosis.</p>
          </article>

          <div className="row no-print report-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print or save as PDF</button>
            <button type="button" className="btn btn-quiet" onClick={() => download(`bodytrace-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(scoped), "text/csv")}>
              Download spreadsheet
            </button>
          </div>
        </>
      )}
    </div>
  );
}
