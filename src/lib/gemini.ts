/**
 * Minimal Gemini REST client. Bring-your-own-key: requests go straight from
 * this device to Google under the user's own key; nothing passes through us.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export class GeminiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function explain(status: number, body: string): string {
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(body)) return "Gemini didn't accept that key. Check it in Settings.";
  if (status === 403) return "This key isn't allowed to use the Gemini API. Check the key's restrictions in Google AI Studio.";
  if (status === 404) return "That model isn't available for this key. Pick another model in Settings.";
  if (status === 429) return "Your Gemini quota is used up for now. Try again in a minute.";
  if (status >= 500) return "Gemini is having trouble right now. Try again shortly.";
  return `Gemini returned an error (${status}).`;
}

async function call(path: string, key: string, init?: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key, ...init?.headers },
    });
  } catch {
    throw new GeminiError("Couldn't reach Gemini. Check your connection.");
  }
  if (!res.ok) throw new GeminiError(explain(res.status, await res.text()), res.status);
  return res.json();
}

export interface JsonRequest {
  key: string;
  model: string;
  system: string;
  prompt: string;
  /** OpenAPI-style schema, as accepted by Gemini's responseSchema. */
  schema: object;
  signal?: AbortSignal;
}

export async function generateJson<T>({ key, model, system, prompt, schema, signal }: JsonRequest): Promise<T> {
  const data = (await call(`models/${encodeURIComponent(model)}:generateContent`, key, {
    method: "POST",
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 },
    }),
  })) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError("Gemini sent back something unexpected. Try again.");
  }
}

/** Models this key can use for text generation, newest names first. */
export async function listModels(key: string): Promise<string[]> {
  const data = (await call("models?pageSize=200", key)) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
  };
  return (data.models ?? [])
    .filter((m) => m.name.includes("gemini") && m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => !/embedding|tts|image|audio|live/i.test(n))
    .sort()
    .reverse();
}
