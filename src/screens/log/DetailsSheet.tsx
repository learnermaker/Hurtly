import { Chips, Field, IntensityScale, Sheet } from "../../components/Controls";
import { regionLabel } from "../../data/regions";
import { safetyNotice } from "../../lib/safety";
import { IMPACT_OPTIONS, PATTERNS, QUALITIES, RELIEF_SUGGESTIONS, TRIGGER_SUGGESTIONS, type Draft, type Pattern, type Quality } from "../../lib/types";

interface Props {
  open: boolean;
  draft: Draft;
  regions: string[];
  onChange: (d: Draft) => void;
  onRemoveRegion: (id: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function DetailsSheet({ open, draft, regions, onChange, onRemoveRegion, onClose, onSave }: Props) {
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => onChange({ ...draft, [k]: v });
  const notice = safetyNotice({ ...draft, regions });
  const hasMore = !!(draft.pattern || draft.triggers.length || draft.relief.length || draft.impact.length || draft.note);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={regions.length ? regions.map(regionLabel).join(", ") : "Describe it"}
      footer={
        <button type="button" className="btn btn-primary btn-wide" disabled={regions.length === 0} onClick={onSave}>
          Save entry
        </button>
      }
    >
      {regions.length > 1 && (
        <div className="chips" aria-label="Areas">
          {regions.map((r) => (
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
