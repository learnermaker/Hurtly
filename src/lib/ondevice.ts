/**
 * The browser's built-in language model (Chrome's Prompt API, Gemini Nano).
 * Prompts and answers never leave the device. The model is downloaded once
 * per browser, and only after a user gesture.
 */

export type DeviceStatus = Availability | "unsupported";

const LANGUAGES = { expectedInputs: [{ type: "text" as const, languages: ["en"] }], expectedOutputs: [{ type: "text" as const, languages: ["en"] }] };

function api(): typeof LanguageModel | undefined {
  return (globalThis as { LanguageModel?: typeof LanguageModel }).LanguageModel;
}

export async function deviceStatus(): Promise<DeviceStatus> {
  const lm = api();
  if (!lm) return "unsupported";
  try {
    return await lm.availability(LANGUAGES);
  } catch {
    return "unavailable";
  }
}

/** Downloads the model if needed. Must be called from a click or tap. */
export async function prepareDevice(onProgress: (fraction: number) => void): Promise<void> {
  const lm = api();
  if (!lm) throw new Error("This browser doesn't have built-in AI.");
  const session = await lm.create({
    ...LANGUAGES,
    monitor: (m) => m.addEventListener("downloadprogress", (e) => onProgress(e.loaded)),
  });
  session.destroy();
}

/**
 * Converts the OpenAPI-style schemas we send Gemini (with `nullable`) into
 * the JSON Schema the Prompt API expects.
 */
export function toJsonSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toJsonSchema);
  if (!schema || typeof schema !== "object") return schema;
  const { nullable, ...rest } = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) out[k] = k === "enum" ? v : toJsonSchema(v);
  if (nullable) {
    out.type = [out.type, "null"];
    if (Array.isArray(out.enum)) out.enum = [...out.enum, null];
  }
  return out;
}

export async function deviceJson<T>({ system, prompt, schema, signal }: { system: string; prompt: string; schema: object; signal?: AbortSignal }): Promise<T> {
  const lm = api();
  if (!lm || (await deviceStatus()) !== "available") {
    throw new Error("On-device AI isn't ready. Check Settings.");
  }
  const session = await lm.create({ ...LANGUAGES, signal, initialPrompts: [{ role: "system", content: system }] });
  try {
    const text = await session.prompt(prompt, { responseConstraint: toJsonSchema(schema) as Record<string, unknown>, signal });
    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error("The on-device model sent back something unexpected. Try again.");
    throw e;
  } finally {
    session.destroy();
  }
}
