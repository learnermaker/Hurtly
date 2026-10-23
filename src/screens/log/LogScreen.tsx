import { useCallback, useEffect, useMemo, useState } from "react";
import { BodyCanvas, type Tool } from "../../components/BodyCanvas";
import { Toast } from "../../components/Toast";
import { primaryView, regionLabel, type View } from "../../data/regions";
import { addEntry, lastEntryFor } from "../../lib/db";
import { daysAgo } from "../../lib/format";
import { useEntries } from "../../lib/hooks";
import { clonePaint, heatCells, mergePaint, paintFromRegions, paintOf, toDrawing, type Paint } from "../../lib/mask";
import { navigate } from "../../lib/route";
import { aiReady, useSettings } from "../../lib/settings";
import { inRange, summarizeRegions } from "../../lib/stats";
import { draftFrom, emptyDraft, type Draft, type Entry } from "../../lib/types";
import { DescribeSheet } from "./DescribeSheet";
import { DetailsSheet } from "./DetailsSheet";
import { FindSheet } from "./FindSheet";
import { SavedSheet } from "./SavedSheet";
import { usePaintEditor } from "./usePaintEditor";

type Step = null | "describe" | "find" | "details" | "saved";

const TOOLS: [Tool, string][] = [
  ["paint", "Paint"],
  ["erase", "Erase"],
  ["arrow", "Spreads"],
];

const NO_ENTRIES: Entry[] = [];

export function LogScreen({ repeat }: { repeat: string | null }) {
  const settings = useSettings();
  const entries = useEntries() ?? NO_ENTRIES;
  const editor = usePaintEditor();
  const [view, setView] = useState<View>("front");
  const [tool, setTool] = useState<Tool>("paint");
  const [step, setStep] = useState<Step>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saved, setSaved] = useState<Entry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const recentHeat = useMemo(() => heatCells(inRange(entries, daysAgo(14)), view), [entries, view]);
  const recentSpots = useMemo(() => summarizeRegions(inRange(entries, daysAgo(60))).slice(0, 6), [entries]);

  function openDetails(d: Draft, paint: Paint, regions: string[]) {
    setDraft(d);
    editor.replace(paint);
    // Turn the figure around if everything is on the other side.
    if (regions[0] && !paint[view].some(Boolean)) setView(primaryView(regions[0]));
    setStep("details");
  }

  async function logAgain(regionId: string) {
    const last = await lastEntryFor(regionId);
    if (last) openDetails(draftFrom(last), clonePaint(paintOf(last)), last.regions);
    else openDetails(emptyDraft(), paintFromRegions([regionId]), [regionId]);
  }

  // Arriving from "Log it again" elsewhere in the app.
  useEffect(() => {
    if (!repeat) return;
    logAgain(repeat);
    navigate("log");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat]);

  async function save() {
    const entry = await addEntry({ ...draft, regions: editor.regions, drawing: toDrawing(editor.paint), kind: "pain", followUps: [] });
    setSaved(entry);
    editor.reset();
    setStep("saved");
  }

  async function logPainFree() {
    await addEntry({ ...emptyDraft(), regions: [], intensity: 0, kind: "clear", followUps: [] });
    setToast("Logged a pain-free day");
  }

  const ai = aiReady(settings);

  return (
    <div className="log">
      <header className="screen-head">
        <h1>Where does it hurt?</h1>
        <div className="seg" role="radiogroup" aria-label="Body view">
          {(["front", "back"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} className={`seg-btn${view === v ? " is-on" : ""}`} onClick={() => setView(v)}>
              {v === "front" ? "Front" : "Back"}
              {editor.painted[v] && view !== v && <span className="seg-dot" aria-label="(painted)" />}
            </button>
          ))}
        </div>
      </header>

      <BodyCanvas
        view={view}
        paint={editor.paint}
        tool={tool}
        heat={recentHeat}
        selected={editor.regions}
        onStrokeStart={editor.checkpoint}
        onChange={editor.touched}
        onRegionToggle={editor.toggleRegion}
        className="bodyc--log"
        label={`Body, ${view} view. Paint where it hurts, or use Tab and Enter to select areas.`}
      />
      <p className="figure-caption">
        {view === "front" ? "Facing you, so your right side is on the left" : "From behind, so your left side is on the left"}
      </p>

      <div className="tools" role="toolbar" aria-label="Drawing tools">
        <div className="seg" role="radiogroup" aria-label="Tool">
          {TOOLS.map(([t, name]) => (
            <button key={t} type="button" role="radio" aria-checked={tool === t} className={`seg-btn${tool === t ? " is-on" : ""}`} onClick={() => setTool(t)}>
              {name}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn" onClick={editor.undo} disabled={!editor.canUndo} aria-label="Undo">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {tool === "arrow" && <p className="tool-hint">Drag from where the pain starts to where it travels.</p>}

      <div className="log-actions">
        {editor.isEmpty ? (
          <>
            <div className="row">
              <button type="button" className="btn btn-primary btn-wide" onClick={() => setStep("describe")}>
                <SparkIcon /> Tell it in your words
              </button>
            </div>
            <div className="row row-quiet">
              <button type="button" className="link" onClick={() => setStep("find")}>Find an area by name</button>
              <button type="button" className="link" onClick={logPainFree}>No pain today</button>
            </div>
            {recentSpots.length > 0 && (
              <section className="recent" aria-label="Log a recent area again">
                <h2 className="mini-head">Log again</h2>
                <div className="chips">
                  {recentSpots.map((r) => (
                    <button key={r.regionId} type="button" className="chip" onClick={() => logAgain(r.regionId)}>
                      {regionLabel(r.regionId)}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          <div className="selection">
            <p className="selection-text">{editor.regions.length ? editor.regions.map(regionLabel).join(", ") : "Paint a little more so the area is clear"}</p>
            <div className="row">
              <button type="button" className="btn btn-quiet" onClick={editor.reset}>Clear</button>
              <button type="button" className="btn btn-primary" disabled={editor.regions.length === 0} onClick={() => openDetails(emptyDraft(), editor.paint, editor.regions)}>
                Describe it
              </button>
            </div>
          </div>
        )}
      </div>

      <DescribeSheet
        open={step === "describe"}
        ai={ai}
        onClose={() => setStep(null)}
        onParsed={(d, regions) => openDetails(d, mergePaint(editor.paint, paintFromRegions(regions)), regions)}
      />
      <FindSheet open={step === "find"} selected={editor.regions} onToggle={editor.toggleRegion} onClose={() => setStep(null)} />
      <DetailsSheet
        open={step === "details"}
        draft={draft}
        regions={editor.regions}
        onChange={setDraft}
        onRemoveRegion={editor.removeRegion}
        onClose={() => setStep(null)}
        onSave={save}
      />
      <SavedSheet open={step === "saved"} entry={saved} history={entries} ai={ai} onClose={() => setStep(null)} />
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" fill="currentColor" />
    </svg>
  );
}
