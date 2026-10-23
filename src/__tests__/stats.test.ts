import { dailySeries, overview, summarizeRegions, trendOf } from "../lib/stats";
import { makeEntry } from "./helpers";

const DAY = 86_400_000;
const T0 = new Date(2026, 0, 1, 12).getTime();
const on = (day: number, regions: string[], intensity: number, extra = {}) => makeEntry({ createdAt: T0 + day * DAY, regions, intensity, ...extra });

it.each([
  [[5, 6], "too few"],
  [[2, 3, 3, 5, 6, 7], "worse"],
  [[7, 6, 6, 4, 3, 2], "better"],
  [[4, 5, 4, 5, 4, 5], "steady"],
])("trendOf(%j) is %s", (xs, expected) => {
  expect(trendOf(xs)).toBe(expected);
});

describe("summaries", () => {
  const entries = [
    on(0, ["knee-l"], 3, { qualities: ["sharp"], triggers: ["stairs"] }),
    on(1, ["knee-l", "hip-l"], 5, { qualities: ["sharp", "aching"] }),
    on(1, ["knee-l"], 7),
    on(2, ["knee-l"], 8, { triggers: ["stairs"] }),
    on(3, [], 0, { kind: "clear" }),
  ];

  it("summarizes each area, counting multi-area entries for each", () => {
    const s = summarizeRegions(entries);
    expect(s.find((r) => r.regionId === "knee-l")).toMatchObject({ count: 4, peak: 8, latest: 8, average: 5.8, trend: "worse", triggers: ["stairs"] });
    expect(s.find((r) => r.regionId === "hip-l")?.count).toBe(1);
  });

  it("keeps each day's worst reading for charts", () => {
    expect(dailySeries(entries, "knee-l").map((p) => p.value)).toEqual([3, 7, 8]);
  });

  it("counts a pain-free day only when no pain was logged that day", () => {
    expect(overview([...entries, on(2, [], 0, { kind: "clear" })])).toMatchObject({ daysLogged: 4, painDays: 3, painFreeDays: 1 });
  });
});
