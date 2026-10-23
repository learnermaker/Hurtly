import { safetyNotice } from "../lib/safety";
import { fallbackQuestions } from "../data/questions";
import { makeEntry } from "./helpers";

it.each([
  ["strong chest pain", ["chest-l"], 7, undefined, /emergency/],
  ["chest pain with breathlessness", ["chest-r"], 2, "short of breath", /emergency/],
  ["back pain with bladder changes", ["lower-back-l"], 4, "trouble with my bladder", /urgent/],
  ["everyday knee pain", ["knee-l"], 8, undefined, null],
])("safety notice for %s", (_, regions, intensity, note, expected) => {
  const notice = safetyNotice({ regions, intensity, qualities: [], note });
  if (expected) expect(notice).toMatch(expected);
  else expect(notice).toBeNull();
});

describe("offline follow-up questions", () => {
  const entry = makeEntry({ id: "new", regions: ["lower-back-r"], qualities: ["stiff"] });

  it("asks when a new area started, then something specific", () => {
    const qs = fallbackQuestions(entry, [entry]);
    expect(qs.map((q) => q.question)).toEqual(["When did this start?", "Is it stiffest first thing in the morning?"]);
  });

  it("doesn't repeat questions already answered for a known area", () => {
    const earlier = makeEntry({ ...entry, id: "old", followUps: [{ question: "Is it stiffest first thing in the morning?", answer: "Yes" }] });
    expect(fallbackQuestions(entry, [earlier, entry]).map((q) => q.question)).toEqual(["Does it spread down into a leg?"]);
  });
});
