import { generateJson } from "./gemini";
import { getSettings } from "./settings";
import { REGIONS, isRegionId, regionLabel } from "../data/regions";
import { PATTERNS, QUALITIES, type Entry, type Pattern, type Quality } from "./types";
import type { Overview, RegionSummary } from "./stats";
import { formatDate } from "./format";

const SYSTEM = `You help people keep an accurate personal pain diary.
You never diagnose, name conditions, or recommend treatments or medicines.
Use plain, warm, everyday language. Be brief.`;

function request<T>(prompt: string, schema: object, signal?: AbortSignal, system = SYSTEM) {
  const { geminiKey, model } = getSettings();
  return generateJson<T>({ key: geminiKey, model, system, prompt, schema, signal });
}

const str = { type: "string" };
const strList = { type: "array", items: str };

function cleanList(xs: unknown, max: number): string[] {
  if (!Array.isArray(xs)) return [];
  const seen = new Set<string>();
  for (const x of xs) {
    if (typeof x !== "string") continue;
    const v = x.trim().toLowerCase();
    if (v && v.length <= 40) seen.add(v);
  }
  return [...seen].slice(0, max);
}

// ---------- Describe it: free text → structured entry ----------

export interface ParsedDescription {
  regions: string[];
  intensity: number | null;
  qualities: Quality[];
  pattern: Pattern | null;
  triggers: string[];
  relief: string[];
  impact: string[];
  note: string;
}

/** Keeps only values the app understands; anything the model invents is dropped. */
export function normalizeParsed(raw: Partial<Record<keyof ParsedDescription, unknown>>): ParsedDescription {
  const regions = Array.isArray(raw.regions) ? raw.regions.filter((r): r is string => typeof r === "string" && isRegionId(r)) : [];
  const n = typeof raw.intensity === "number" && Number.isFinite(raw.intensity) ? Math.round(Math.min(10, Math.max(0, raw.intensity))) : null;
  return {
    regions: [...new Set(regions)],
    intensity: n,
    qualities: cleanList(raw.qualities, 4).filter((q): q is Quality => (QUALITIES as readonly string[]).includes(q)),
    pattern: (PATTERNS as readonly unknown[]).includes(raw.pattern) ? (raw.pattern as Pattern) : null,
    triggers: cleanList(raw.triggers, 5),
    relief: cleanList(raw.relief, 5),
    impact: cleanList(raw.impact, 5),
    note: typeof raw.note === "string" ? raw.note.trim().slice(0, 500) : "",
  };
}

export async function parseDescription(text: string, signal?: AbortSignal): Promise<ParsedDescription> {
  const regionList = REGIONS.map((r) => `${r.id}: ${r.label}`).join("\n");
  const prompt = `Turn this description into diary fields.

Description: """${text}"""

Body regions (use only these ids; "left"/"right" mean the person's own left/right):
${regionList}

Rules:
- regions: every region the person mentions. If they name a broad area ("my back", "my legs"), choose the most fitting ids, both sides if unspecified.
- intensity: 0–10 only if they give a number or a clear word (mild≈3, bad≈6, severe≈8, worst ever=10); otherwise null.
- qualities: from ${QUALITIES.join(", ")}.
- pattern: one of ${PATTERNS.join(", ")}, or null.
- triggers: short phrases for what makes it worse. relief: what helps. impact: daily activities it gets in the way of (e.g. sleep, work, walking).
- note: anything else worth keeping, in their words, one or two sentences. Empty if nothing.`;

  const raw = await request<Partial<Record<keyof ParsedDescription, unknown>>>(
    prompt,
    {
      type: "object",
      properties: {
        regions: { type: "array", items: { type: "string", enum: REGIONS.map((r) => r.id) } },
        intensity: { type: "integer", nullable: true },
        qualities: { type: "array", items: { type: "string", enum: [...QUALITIES] } },
        pattern: { type: "string", enum: [...PATTERNS], nullable: true },
        triggers: strList,
        relief: strList,
        impact: strList,
        note: str,
      },
      required: ["regions", "intensity", "qualities", "pattern", "triggers", "relief", "impact", "note"],
    },
    signal,
  );
  return normalizeParsed(raw);
}

// ---------- Follow-up questions ----------

export interface Question {
  question: string;
  options: string[];
}

function describeEntry(e: Pick<Entry, "regions" | "intensity" | "qualities" | "pattern" | "triggers" | "relief" | "note" | "followUps"> & { createdAt?: number }): string {
  const parts = [
    e.createdAt ? formatDate(e.createdAt) : "now",
    e.regions.map(regionLabel).join(", "),
    `${e.intensity}/10`,
    e.qualities.join("/"),
    e.pattern,
    e.triggers.length ? `worse with ${e.triggers.join(", ")}` : "",
    e.relief.length ? `better with ${e.relief.join(", ")}` : "",
    e.note ? `note: ${e.note}` : "",
    ...e.followUps.map((f) => `Q: ${f.question} A: ${f.answer}`),
  ];
  return parts.filter(Boolean).join(" · ");
}

export async function followUpQuestions(entry: Entry, history: Entry[], signal?: AbortSignal): Promise<Question[]> {
  const past = history
    .filter((h) => h.id !== entry.id && h.kind === "pain" && h.regions.some((r) => entry.regions.includes(r)))
    .slice(-6)
    .map((h) => `- ${describeEntry(h)}`)
    .join("\n");

  const prompt = `The person just logged: ${describeEntry(entry)}

Earlier entries for the same areas:
${past || "(none — first time logging this area)"}

Ask at most 2 short follow-up questions that would make this record more useful to a clinician later — things like onset, spread, what changed since last time, or what they were doing. Don't ask about anything already answered. If an earlier entry is relevant, refer to it ("Last time you said…"). Give 2–4 one-tap answer options per question. Return an empty list if nothing useful is missing.`;

  const res = await request<{ questions?: Question[] }>(
    prompt,
    {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: { type: "object", properties: { question: str, options: strList }, required: ["question", "options"] },
        },
      },
      required: ["questions"],
    },
    signal,
  );
  return (res.questions ?? [])
    .filter((q) => typeof q.question === "string" && q.question.trim())
    .slice(0, 2)
    .map((q) => ({ question: q.question.trim(), options: cleanOptions(q.options) }));
}

function cleanOptions(xs: unknown, max = 4): string[] {
  if (!Array.isArray(xs)) return [];
  return xs.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, max);
}

// ---------- Clinician summary ----------

export interface Narrative {
  overview: string;
  keyPoints: string[];
  questionsToAsk: string[];
}

export async function writeSummary(
  range: { from: number; to: number },
  stats: Overview,
  regions: RegionSummary[],
  entries: Entry[],
  signal?: AbortSignal,
): Promise<Narrative> {
  const regionLines = regions
    .map(
      (r) =>
        `- ${regionLabel(r.regionId)}: ${r.count} entries, first ${formatDate(r.first)}, last ${formatDate(r.last)}, average ${r.average}/10, peak ${r.peak}/10, trend ${r.trend}; feels ${r.qualities.join(", ") || "n/a"}; worse with ${r.triggers.join(", ") || "n/a"}; better with ${r.relief.join(", ") || "n/a"}`,
    )
    .join("\n");
  const notes = entries
    .filter((e) => e.note || e.followUps.length)
    .slice(-15)
    .map((e) => `- ${describeEntry(e)}`)
    .join("\n");

  const prompt = `Write a short summary of this pain diary for the person to show their clinician.

Period: ${formatDate(range.from)} to ${formatDate(range.to)}
Days logged: ${stats.daysLogged}; days with pain: ${stats.painDays}; pain-free check-ins: ${stats.painFreeDays}

Areas:
${regionLines || "(none)"}

Notes and answers:
${notes || "(none)"}

Write:
- overview: 2–4 sentences in the first person ("I've had…"), factual, covering the main areas, how long, how bad, and the direction it's going.
- keyPoints: 3–6 short factual bullets a clinician would want (patterns, triggers, what helps, impact on daily life).
- questionsToAsk: 2–4 questions the person might ask their clinician, based only on this data.
Use only the data above. Don't guess causes or name conditions.`;

  const res = await request<Partial<Narrative>>(prompt, {
    type: "object",
    properties: { overview: str, keyPoints: strList, questionsToAsk: strList },
    required: ["overview", "keyPoints", "questionsToAsk"],
  }, signal);
  return {
    overview: typeof res.overview === "string" ? res.overview.trim() : "",
    keyPoints: cleanOptions(res.keyPoints, 6),
    questionsToAsk: cleanOptions(res.questionsToAsk),
  };
}
