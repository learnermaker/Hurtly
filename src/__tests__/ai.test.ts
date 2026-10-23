import { followUpQuestions, normalizeParsed, parseDescription } from "../lib/ai";
import { updateSettings } from "../lib/settings";
import type { Entry } from "../lib/types";

function geminiReply(obj: unknown) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });
}

describe("normalizeParsed", () => {
  it("drops unknown regions and qualities and clamps intensity", () => {
    const p = normalizeParsed({
      regions: ["lower-back-r", "spleen", "lower-back-r"],
      intensity: 14.2,
      qualities: ["burning", "electric"],
      pattern: "sometimes",
      triggers: ["  Sitting ", "sitting", 3],
      note: "since Monday",
    });
    expect(p.regions).toEqual(["lower-back-r"]);
    expect(p.intensity).toBe(10);
    expect(p.qualities).toEqual(["burning"]);
    expect(p.pattern).toBeNull();
    expect(p.triggers).toEqual(["sitting"]);
    expect(p.note).toBe("since Monday");
  });

  it("treats a missing intensity as unknown, not zero", () => {
    expect(normalizeParsed({ intensity: null }).intensity).toBeNull();
  });
});

describe("Gemini calls", () => {
  beforeEach(() => updateSettings({ geminiKey: "test-key", aiEnabled: true, model: "gemini-flash-latest" }));
  afterEach(() => vi.restoreAllMocks());

  it("sends the user's key and a JSON schema, and normalizes the answer", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      geminiReply({ regions: ["knee-l"], intensity: 6, qualities: ["sharp"], pattern: "only when moving", triggers: ["stairs"], relief: [], impact: [], note: "" }),
    );
    const p = await parseDescription("left knee is sharp on stairs, about a 6");
    expect(p).toMatchObject({ regions: ["knee-l"], intensity: 6, pattern: "only when moving" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("models/gemini-flash-latest:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseSchema.properties.regions.items.enum).toContain("knee-l");
  });

  it("explains a rejected key in plain words", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"error":{"message":"API key not valid"}}', { status: 400 }));
    await expect(parseDescription("my head")).rejects.toThrow(/didn't accept that key/);
  });

  it("caps follow-ups at two and drops empty questions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      geminiReply({ questions: [{ question: "A?", options: ["Yes", "No"] }, { question: " ", options: [] }, { question: "B?", options: [] }, { question: "C?", options: [] }] }),
    );
    const entry: Entry = { id: "1", createdAt: 0, kind: "pain", regions: ["knee-l"], intensity: 5, qualities: [], triggers: [], relief: [], impact: [], followUps: [], source: "tap" };
    const qs = await followUpQuestions(entry, []);
    expect(qs.map((q) => q.question)).toEqual(["A?", "B?"]);
  });
});
