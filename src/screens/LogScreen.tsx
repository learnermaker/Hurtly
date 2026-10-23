import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BodyCanvas, type Tool } from "../components/BodyCanvas";
import { Chips, Field, IntensityScale, Sheet } from "../components/Controls";
import { Toast } from "../components/Toast";
import { REGIONS, primaryView, regionLabel, type View } from "../data/regions";
import { fallbackQuestions } from "../data/questions";
import { addEntry, allEntries, db, lastEntryFor } from "../lib/db";
import { followUpQuestions, parseDescription, type Question } from "../lib/ai";
import { aiReady, useSettings } from "../lib/settings";
import { safetyNotice } from "../lib/safety";
import { inRange, summarizeRegions } from "../lib/stats";
import { clearRegion, clonePaint, emptyPaint, heatCells, paintFromRegions, paintOf, regionsInPaint, setRegion, toDrawing, type Paint } from "../lib/mask";
import { daysAgo } from "../lib/format";
import { listen, speechSupported } from "../lib/speech";
import { navigate } from "../lib/route";
import {
  IMPACT_OPTIONS,
  PATTERNS,
  QUALITIES,
  RELIEF_SUGGESTIONS,
  TRIGGER_SUGGESTIONS,
  emptyDraft,
  type Draft,
  type Entry,
  type Pattern,
  type Quality,
} from "../lib/types";

type Step = null | "describe" | "find" | "details" | "saved";

const UNDO_LIMIT = 40;

function mergePaint(a: Paint, b: Paint): Paint {
  const out = clonePaint(a);
  for (let i = 0; i < out.front.length; i++) {
    out.front[i] |= b.front[i];
    out.back[i] |= b.back[i];
  }
  out.arrows.push(...b.arrows);
  return out;
}

export function LogScreen({ repeat }: { repeat: string | null }) {
  const settings = useSettings();
  const entries = useLiveQuery(allEntries, [], [] as Entry[]);
  const [view, setView] = useState<View>("front");
  const [tool, setTool] = useState<Tool>("paint");
  const [paint, setPaintState] = useState<Paint>(emptyPaint);
  const [version, setVersion] = useState(0);
  const undoStack = useRef<Paint[]>([]);
  const [step, setStep] = useState<Step>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saved, setSaved] = useState<Entry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  // Painting mutates `paint` in place, so `version` is what invalidates derived values.
  const regions = useMemo(() => regionsInPaint(paint), [paint, version]);
  const painted = useMemo(() => ({ front: paint.front.some(Boolean), back: paint.back.some(Boolean) }), [paint, version]);
  const recent = useMemo(() => inRange(entries, daysAgo(14)), [entries]);
  const recentHeat = useMemo(() => heatCells(recent, view), [recent, view]);
  const recentSpots = useMemo(() => summarizeRegions(inRange(entries, daysAgo(60))).slice(0, 6), [entries]);

  function pushUndo(before: Paint) {
    undoStack.current.push(before);
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
  }

  /** Replaces the paint with a new object (so the canvas redraws), keeping an undo step. */
  function setPaint(next: Paint, undoable = true) {
    if (undoable) pushUndo(clonePaint(paint));
    setPaintState(next);
    setVersion((v) => v + 1);
  }

  function undo() {
    const prev = undoStack.current.pop();
    if (prev) {
      setPaintState(prev);
      setVersion((v) => v + 1);
    }
  }

  function toggleRegion(id: string) {
    const next = clonePaint(paint);
    if (regions.includes(id)) clearRegion(next, id);
    else for (const v of ["front", "back"] as const) setRegion(next[v], v, id, 1);
    setPaint(next);
  }

  function openDetails(d: Draft, p: Paint) {
    setDraft(d);
    setPaint(p);
    const first = d.regions[0];
    if (first && !p[view].some(Boolean)) setView(primaryView(first));
    setStep("details");
  }

  async function logAgain(regionId: string) {
    const last = await lastEntryFor(regionId);
    if (!last) return openDetails(emptyDraft([regionId]), paintFromRegions([regionId]));
    openDetails(
      {
        regions: last.regions,
        intensity: last.intensity,
        qualities: last.qualities,
        pattern: last.pattern,
        triggers: last.triggers,
        relief: last.relief,
        impact: last.impact,
        source: "repeat",
      },
      clonePaint(paintOf(last)),
    );
  }

  // Arriving from "Log it again" on a region page.
  useEffect(() => {
    if (repeat) {
      logAgain(repeat);
      navigate("log");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat]);

  function removeFromDraft(id: string) {
    const next = clonePaint(paint);
    clearRegion(next, id);
    setPaint(next);
    setDraft({ ...draft, regions: regionsInPaint(next) });
  }

  async function save() {
    const entry = await addEntry({ ...draft, regions: regionsInPaint(paint), drawing: toDrawing(paint), kind: "pain", followUps: [] });
    setSaved(entry);
    setPaint(emptyPaint(), false);
    undoStack.current = [];
    setStep("saved");
  }

  async function logClear() {
    await addEntry({ ...emptyDraft(), intensity: 0, kind: "clear", followUps: [] });
    setToast("Logged a pain-free day");
  }

  const ai = aiReady(settings);
  const hasPaint = painted.front || painted.back || paint.arrows.length > 0;

  return (
    <div className="log">
      <header className="screen-head">
        <h1>Where does it hurt?</h1>
        <div className="seg" role="radiogroup" aria-label="Body view">
          {(["front", "back"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={view === v} className={`seg-btn${view === v ? " is-on" : ""}`} onClick={() => setView(v)}>
              {v === "front" ? "Front" : "Back"}
              {painted[v] && view !== v && <span className="seg-dot" aria-label="(painted)" />}
            </button>
          ))}
        </div>
      </header>

      <BodyCanvas
        view={view}
        paint={paint}
        tool={tool}
        heat={recentHeat}
        selected={regions}
        onStrokeStart={pushUndo}
        onChange={() => setVersion((v) => v + 1)}
        onRegionToggle={toggleRegion}
        className="bodyc--log"
        label={`Body, ${view} view. Paint where it hurts, or use Tab and Enter to select areas.`}
      />
      <p className="figure-caption">
        {view === "front" ? "Facing you, so your right side is on the left" : "From behind, so your left side is on the left"}
      </p>

      <div className="tools" role="toolbar" aria-label="Drawing tools">
        <div className="seg" role="radiogroup" aria-label="Tool">
          {(
            [
              ["paint", "Paint"],
              ["erase", "Erase"],
              ["arrow", "Spreads"],
            ] as const
          ).map(([t, name]) => (
            <button key={t} type="button" role="radio" aria-checked={tool === t} className={`seg-btn${tool === t ? " is-on" : ""}`} onClick={() => setTool(t)}>
              {name}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn" onClick={undo} disabled={undoStack.current.length === 0} aria-label="Undo">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {tool === "arrow" && <p className="tool-hint">Drag from where the pain starts to where it travels.</p>}

      <div className="log-actions">
        {hasPaint ? (
          <div className="selection">
            <p className="selection-text">{regions.length ? regions.map(regionLabel).join(", ") : "Paint a little more so the area is clear"}</p>
            <div className="row">
              <button type="button" className="btn btn-quiet" onClick={() => setPaint(emptyPaint())}>Clear</button>
              <button type="button" className="btn btn-primary" disabled={regions.length === 0} onClick={() => openDetails(emptyDraft(regions), paint)}>
                Describe it
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="row">
              <button type="button" className="btn btn-primary btn-wide" onClick={() => setStep("describe")}>
                <SparkIcon /> Tell it in your words
              </button>
            </div>
            <div className="row row-quiet">
              <button type="button" className="link" onClick={() => setStep("find")}>Find an area by name</button>
              <button type="button" className="link" onClick={logClear}>No pain today</button>
            </div>
          </>
        )}

        {recentSpots.length > 0 && !hasPaint && (
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
      </div>

      <DescribeSheet
        open={step === "describe"}
        ai={ai}
        onClose={() => setStep(null)}
        onParsed={(d) => openDetails(d, mergePaint(paint, paintFromRegions(d.regions)))}
      />
      <FindSheet open={step === "find"} selected={regions} onToggle={toggleRegion} onClose={() => setStep(null)} />
      <DetailsSheet open={step === "details"} draft={draft} onChange={setDraft} onRemoveRegion={removeFromDraft} onClose={() => setStep(null)} onSave={save} />
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

function DescribeSheet({ open, ai, onClose, onParsed }: { open: boolean; ai: boolean; onClose: () => void; onParsed: (d: Draft) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stop, setStop] = useState<null | (() => void)>(null);

  useEffect(() => {
    if (!open) {
      stop?.();
      setStop(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function mic() {
    if (stop) {
      stop();
      setStop(null);
      return;
    }
    const before = text ? text.trimEnd() + " " : "";
    const s = listen(
      (t) => setText(before + t),
      () => setStop(null),
    );
    setStop(() => s);
  }

  async function fill() {
    stop?.();
    setBusy(true);
    setError(null);
    try {
      const p = await parseDescription(text);
      if (p.regions.length === 0) {
        setError("I couldn't tell which part of the body you mean. Add where it hurts, like \"left knee\" or \"lower back\".");
        return;
      }
      onParsed({
        regions: p.regions,
        intensity: p.intensity ?? 4,
        qualities: p.qualities,
        pattern: p.pattern ?? undefined,
        triggers: p.triggers,
        relief: p.relief,
        impact: p.impact,
        note: p.note || undefined,
        source: "describe",
      });
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Tell it in your words"
      footer={
        ai && (
          <button type="button" className="btn btn-primary btn-wide" disabled={busy || text.trim().length < 3} onClick={fill}>
            {busy ? "Reading…" : "Fill in the details"}
          </button>
        )
      }
    >
      {ai ? (
        <>
          <p className="muted">Say where it hurts, what it feels like, and anything that makes it better or worse. You'll check everything before it's saved.</p>
          <div className="describe-box">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="My lower right back has been burning since this morning, about a 6. Worse when I sit, better when I walk."
              aria-label="Describe your pain"
            />
            {speechSupported() && (
              <button type="button" className={`mic${stop ? " is-on" : ""}`} onClick={mic} aria-label={stop ? "Stop dictation" : "Dictate"}>
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <p className="fine">Sent to Gemini with your own key.</p>
        </>
      ) : (
        <div className="empty">
          <p>Describing pain in your own words uses Gemini with your own API key. Add a key in Settings to turn it on.</p>
          <p className="muted">You can always log by tapping the body instead — it works offline.</p>
          <a className="btn btn-primary" href="#/settings" onClick={onClose}>Open Settings</a>
        </div>
      )}
    </Sheet>
  );
}

function FindSheet({ open, selected, onToggle, onClose }: { open: boolean; selected: string[]; onToggle: (id: string) => void; onClose: () => void }) {
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

function DetailsSheet({
  open,
  draft,
  onChange,
  onRemoveRegion,
  onClose,
  onSave,
}: {
  open: boolean;
  draft: Draft;
  onChange: (d: Draft) => void;
  onRemoveRegion: (id: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  const notice = safetyNotice(draft);
  const hasMore = !!(draft.pattern || draft.triggers.length || draft.relief.length || draft.impact.length || draft.note);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={draft.regions.length ? draft.regions.map(regionLabel).join(", ") : "Describe it"}
      footer={
        <button type="button" className="btn btn-primary btn-wide" disabled={draft.regions.length === 0} onClick={onSave}>
          Save entry
        </button>
      }
    >
      {draft.regions.length > 1 && (
        <div className="chips" aria-label="Areas">
          {draft.regions.map((r) => (
            <button key={r} type="button" className="chip is-on" onClick={() => onRemoveRegion(r)} aria-label={`Remove ${regionLabel(r)}`}>
              {regionLabel(r)} ×
            </button>
          ))}
        </div>
      )}
      {notice && <p className="safety" role="alert">{notice}</p>}

      <Field label="How bad is it right now?">
        <IntensityScale value={draft.intensity} onChange={(n) => set("intensity", n)} />
      </Field>

      <Field label="What does it feel like?" hint="Pick any">
        <Chips label="Feels like" options={QUALITIES} value={draft.qualities} onChange={(v) => set("qualities", v as Quality[])} />
      </Field>

      <details className="more" open={hasMore}>
        <summary>More detail</summary>
        <Field label="How does it come?">
          <Chips label="Pattern" options={PATTERNS} single value={draft.pattern ? [draft.pattern] : []} onChange={(v) => set("pattern", (v[0] as Pattern) || undefined)} />
        </Field>
        <Field label="Worse with">
          <Chips label="Worse with" options={TRIGGER_SUGGESTIONS} allowCustom value={draft.triggers} onChange={(v) => set("triggers", v)} />
        </Field>
        <Field label="Better with">
          <Chips label="Better with" options={RELIEF_SUGGESTIONS} allowCustom value={draft.relief} onChange={(v) => set("relief", v)} />
        </Field>
        <Field label="Gets in the way of">
          <Chips label="Gets in the way of" options={IMPACT_OPTIONS} allowCustom value={draft.impact} onChange={(v) => set("impact", v)} />
        </Field>
        <Field label="Note">
          <textarea className="input" rows={3} value={draft.note ?? ""} onChange={(e) => set("note", e.target.value || undefined)} placeholder="Anything else you want to remember" />
        </Field>
      </details>
    </Sheet>
  );
}

function SavedSheet({ open, entry, history, ai, onClose }: { open: boolean; entry: Entry | null; history: Entry[]; ai: boolean; onClose: () => void }) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [typing, setTyping] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open || !entry) return;
    setQuestions(null);
    setAnswers({});
    setTyping({});
    const ctl = new AbortController();
    const fallback = () => setQuestions(fallbackQuestions(entry, history));
    if (ai) followUpQuestions(entry, history, ctl.signal).then(setQuestions, () => !ctl.signal.aborted && fallback());
    else fallback();
    return () => ctl.abort();
    // History changes the moment we save; only refetch for a new entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  async function answer(i: number, a: string) {
    if (!entry || !questions || !a.trim()) return;
    const next = { ...answers, [i]: a.trim() };
    setAnswers(next);
    const followUps = Object.entries(next).map(([k, v]) => ({ question: questions[Number(k)].question, answer: v }));
    await db.entries.update(entry.id, { followUps });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Saved" footer={<button type="button" className="btn btn-primary btn-wide" onClick={onClose}>Done</button>}>
      <p className="saved-line">
        {entry && <>{entry.regions.map(regionLabel).join(", ")} · {entry.intensity}/10</>}
      </p>
      {questions === null && <p className="muted">Thinking of a quick question…</p>}
      {questions && questions.length > 0 && (
        <div className="followups">
          <p className="muted">Answering helps your history make sense later. Skip anything you like.</p>
          {questions.map((q, i) => (
            <div key={i} className="followup">
              <p className="followup-q">{q.question}</p>
              {answers[i] ? (
                <p className="followup-a">{answers[i]}</p>
              ) : (
                <>
                  <div className="chips">
                    {q.options.map((o) => (
                      <button key={o} type="button" className="chip" onClick={() => answer(i, o)}>{o}</button>
                    ))}
                  </div>
                  <input
                    className="input input-small"
                    placeholder="Or type an answer"
                    value={typing[i] ?? ""}
                    onChange={(e) => setTyping({ ...typing, [i]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && answer(i, typing[i] ?? "")}
                    aria-label={`Answer: ${q.question}`}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
