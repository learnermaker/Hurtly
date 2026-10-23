import { normalizeParsed, parseDescription } from "../lib/ai";
import { updateSettings } from "../lib/settings";

const geminiReply = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });

it("keeps only values the app understands from AI output", () => {
  const p = normalizeParsed({
    regions: ["lower-back-r", "spleen", "lower-back-r"],
    intensity: 14.2,
    qualities: ["burning", "electric"],
    pattern: "sometimes",
    triggers: ["  Sitting ", "sitting", 3],
  });
  expect(p).toMatchObject({ regions: ["lower-back-r"], intensity: 10, qualities: ["burning"], pattern: null, triggers: ["sitting"] });
  expect(normalizeParsed({ intensity: null }).intensity).toBeNull();
});

describe("Gemini requests", () => {
  beforeEach(() => updateSettings({ geminiKey: "test-key", aiEnabled: true, model: "gemini-flash-latest" }));
  afterEach(() => vi.restoreAllMocks());

  it("sends the user's own key with a JSON schema", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      geminiReply({ regions: ["knee-l"], intensity: 6, qualities: [], pattern: null, triggers: [], relief: [], impact: [], note: "" }),
    );
    expect((await parseDescription("left knee, about a 6")).regions).toEqual(["knee-l"]);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("models/gemini-flash-latest:generateContent");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    expect(JSON.parse(init.body as string).generationConfig.responseSchema.properties.regions.items.enum).toContain("knee-l");
  });

  it("explains a rejected key in plain words", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"error":{"message":"API key not valid"}}', { status: 400 }));
    await expect(parseDescription("my head")).rejects.toThrow(/didn't accept that key/);
  });
});
