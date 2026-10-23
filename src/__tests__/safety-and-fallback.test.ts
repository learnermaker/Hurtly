import { safetyNotice } from "../lib/safety";
import { fallbackQuestions } from "../data/questions";
import type { Entry } from "../lib/types";

const base = { qualities: [] as Entry["qualities"], note: undefined as string | undefined };

describe("safetyNotice", () => {
  it("flags strong chest pain", () => expect(safetyNotice({ ...base, regions: ["chest-l"], intensity: 7 })).toMatch(/emergency/));
  it("flags chest pain described with breathlessness at any intensity", () =>
    expect(safetyNotice({ ...base, regions: ["chest-r"], intensity: 2, note: "short of breath" })).toMatch(/emergency/));
  it("flags back pain with bladder changes", () =>
    expect(safetyNotice({ ...base, regions: ["lower-back-l"], intensity: 4, note: "trouble with my bladder" })).toMatch(/urgent/));
  it("stays quiet for everyday pain", () => expect(safetyNotice({ ...base, regions: ["knee-l"], intensity: 8 })).toBeNull());
});

describe("fallbackQuestions", () => {
  const entry: Entry = { id: "new", createdAt: 1, kind: "pain", regions: ["lower-back-r"], intensity: 5, qualities: ["stiff"], triggers: [], relief: [], impact: [], followUps: [], source: "tap" };

  it("asks when a new area started, then something specific", () => {
    const qs = fallbackQuestions(entry, [entry]);
    expect(qs).toHaveLength(2);
    expect(qs[0].question).toBe("When did this start?");
    expect(qs[1].options.length).toBeGreaterThan(1);
  });

  it("doesn't repeat questions already answered for a known area", () => {
    const earlier: Entry = { ...entry, id: "old", followUps: [{ question: "Is it stiffest first thing in the morning?", answer: "Yes" }] };
    const qs = fallbackQuestions(entry, [earlier, entry]).map((q) => q.question);
    expect(qs).not.toContain("When did this start?");
    expect(qs).not.toContain("Is it stiffest first thing in the morning?");
    expect(qs).toContain("Does it spread down into a leg?");
  });
});
