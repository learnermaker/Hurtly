import { dailySeries, heat, overview, summarizeRegions, trendOf } from "../lib/stats";
import type { Entry } from "../lib/types";

const DAY = 86_400_000;
const T0 = new Date(2026, 0, 1, 12).getTime();

function e(day: number, regions: string[], intensity: number, extra: Partial<Entry> = {}): Entry {
  return {
    id: `${day}-${regions.join()}-${intensity}`,
    createdAt: T0 + day * DAY,
    kind: "pain",
    regions,
    intensity,
    qualities: [],
    triggers: [],
    relief: [],
    impact: [],
    followUps: [],
    source: "tap",
    ...extra,
  };
}

describe("trendOf", () => {
  it("needs three readings", () => expect(trendOf([5, 6])).toBe("too few"));
  it("detects worsening", () => expect(trendOf([2, 3, 3, 5, 6, 7])).toBe("worse"));
  it("detects easing", () => expect(trendOf([7, 6, 6, 4, 3, 2])).toBe("better"));
  it("ignores small wobbles", () => expect(trendOf([4, 5, 4, 5, 4, 5])).toBe("steady"));
});

describe("summaries", () => {
  const entries = [
    e(0, ["knee-l"], 3, { qualities: ["sharp"], triggers: ["stairs"] }),
    e(1, ["knee-l", "hip-l"], 5, { qualities: ["sharp", "aching"] }),
    e(1, ["knee-l"], 7),
    e(2, ["knee-l"], 8, { triggers: ["stairs"] }),
    { ...e(3, [], 0), kind: "clear" as const },
  ];

  it("summarizes per region, counting multi-area entries for each area", () => {
    const s = summarizeRegions(entries);
    const knee = s.find((r) => r.regionId === "knee-l")!;
    expect(knee.count).toBe(4);
    expect(knee.peak).toBe(8);
    expect(knee.latest).toBe(8);
    expect(knee.average).toBe(5.8);
    expect(knee.trend).toBe("worse");
    expect(knee.qualities[0]).toBe("sharp");
    expect(knee.triggers).toEqual(["stairs"]);
    expect(s.find((r) => r.regionId === "hip-l")!.count).toBe(1);
  });

  it("keeps each day's worst reading", () => {
    expect(dailySeries(entries, "knee-l").map((p) => p.value)).toEqual([3, 7, 8]);
  });

  it("colours by highest intensity and ignores pain-free check-ins", () => {
    expect(heat(entries)).toEqual({ "knee-l": 8, "hip-l": 5 });
  });

  it("counts pain-free days only when no pain was logged that day", () => {
    const o = overview([...entries, { ...e(2, [], 0), kind: "clear" }]);
    expect(o).toMatchObject({ daysLogged: 4, painDays: 3, painFreeDays: 1 });
  });
});
