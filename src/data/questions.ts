import type { Entry } from "../lib/types";
import type { Question } from "../lib/ai";
import { REGION_BY_ID } from "./regions";

const YES_NO = ["Yes", "No", "Not sure"];

/** Offline follow-ups, used when AI is off or unavailable. Plain language, one tap to answer. */
const BY_QUALITY: Partial<Record<string, Question[]>> = {
  sharp: [{ question: "Did it come on suddenly or build up?", options: ["Suddenly", "Built up", "Not sure"] }],
  stabbing: [{ question: "Does it come in short bursts?", options: YES_NO }],
  shooting: [{ question: "Does it travel along a line, like down a limb?", options: YES_NO }],
  burning: [{ question: "Is the skin there sensitive to touch?", options: YES_NO }],
  throbbing: [{ question: "Does it pulse in time with your heartbeat?", options: YES_NO }],
  tingling: [{ question: "Is it worse after sitting or lying in one position?", options: YES_NO }],
  numb: [{ question: "Can you still feel some sensation there?", options: ["Some", "None", "Not sure"] }],
  stiff: [{ question: "Is it stiffest first thing in the morning?", options: YES_NO }],
  aching: [{ question: "Does it feel deep inside or close to the surface?", options: ["Deep", "Surface", "Not sure"] }],
  dull: [{ question: "Is it there all the time, or does it come and go?", options: ["All the time", "Comes and goes"] }],
};

const BY_GROUP: Partial<Record<string, Question[]>> = {
  back: [{ question: "Does it spread down into a leg?", options: ["Left leg", "Right leg", "Both", "No"] }],
  neck: [{ question: "Can you turn your head fully both ways?", options: YES_NO }],
  shoulder: [{ question: "Can you raise your arm above your head?", options: ["Easily", "With pain", "Not at all"] }],
  head: [{ question: "Do light or noise make it worse?", options: YES_NO }],
  leg: [{ question: "Is it worse going up or down stairs?", options: ["Up", "Down", "Both", "Neither"] }],
  arm: [{ question: "Is gripping or lifting harder than usual?", options: YES_NO }],
  abdomen: [{ question: "Does eating change it?", options: ["Better", "Worse", "No change"] }],
  chest: [{ question: "Does breathing deeply change it?", options: ["Worse", "No change", "Not sure"] }],
};

const NEW_AREA: Question = { question: "When did this start?", options: ["Today", "This week", "Weeks ago", "Months ago"] };

export function fallbackQuestions(entry: Entry, history: Entry[]): Question[] {
  const asked = new Set(history.flatMap((h) => h.followUps.map((f) => f.question)));
  const isNew = !history.some((h) => h.id !== entry.id && h.regions.some((r) => entry.regions.includes(r)));
  const pool: Question[] = [
    ...(isNew ? [NEW_AREA] : []),
    ...entry.qualities.flatMap((q) => BY_QUALITY[q] ?? []),
    ...entry.regions.flatMap((r) => BY_GROUP[REGION_BY_ID[r]?.group ?? ""] ?? []),
  ];
  const out: Question[] = [];
  for (const q of pool) {
    if (out.length === 2) break;
    if ((q === NEW_AREA || !asked.has(q.question)) && !out.some((o) => o.question === q.question)) out.push(q);
  }
  return out;
}
