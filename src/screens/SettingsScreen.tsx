import { useRef, useState } from "react";
import { DEFAULT_MODEL, updateSettings, useSettings, type AiMode } from "../lib/settings";
import { DeviceAiSetup } from "../components/DeviceAiSetup";
import { listModels } from "../lib/gemini";
import { allEntries, db, replaceAll } from "../lib/db";
import { download, parseBackup, toBackup } from "../lib/export";
import { errorText } from "../lib/format";

const REPO_URL = "https://github.com/learnermaker/Hurtly";

const AI_CHOICES: { mode: AiMode; title: string; sub: string }[] = [
  { mode: "device", title: "On this device", sub: "Private and free. Uses the browser's built-in model; nothing leaves your device." },
  { mode: "gemini", title: "Gemini with your own key", sub: "Works in any browser. Text goes to Google under your key." },
  { mode: "off", title: "Off", sub: "Built-in questions only." },
];

export function SettingsScreen() {
  const s = useSettings();
  const [keyDraft, setKeyDraft] = useState(s.geminiKey);
  const [show, setShow] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "busy"; text: string } | null>(null);
  const [dataMsg, setDataMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // A mode picked but not yet usable (no key saved, model not downloaded) stays "pending" until set up.
  const [pending, setPending] = useState<AiMode | null>(null);

  const shownMode = pending ?? s.aiMode;

  function chooseMode(mode: AiMode) {
    if (mode === "off" || (mode === "gemini" && s.geminiKey)) {
      updateSettings({ aiMode: mode });
      setPending(null);
    } else setPending(mode);
  }

  async function connect() {
    const key = keyDraft.trim();
    if (!key) return;
    setStatus({ kind: "busy", text: "Checking your key…" });
    try {
      const list = await listModels(key);
      setModels(list);
      updateSettings({ geminiKey: key, aiMode: "gemini" });
      setPending(null);
      setStatus({ kind: "ok", text: "Connected. AI features are on." });
    } catch (e) {
      setStatus({ kind: "error", text: errorText(e, "Couldn't check the key.") });
    }
  }

  function forget() {
    updateSettings({ geminiKey: "", aiMode: "off" });
    setKeyDraft("");
    setModels([]);
    setStatus(null);
  }

  async function exportBackup() {
    download(`hurtly-backup-${new Date().toISOString().slice(0, 10)}.json`, toBackup(await allEntries()), "application/json");
  }

  async function importBackup(file: File) {
    try {
      const entries = parseBackup(await file.text());
      if (!confirm(`Replace everything on this device with ${entries.length} entries from this backup?`)) return;
      await replaceAll(entries);
      setDataMsg(`Restored ${entries.length} entries.`);
    } catch (e) {
      setDataMsg(errorText(e, "Couldn't read that file."));
    }
  }

  async function wipe() {
    if (!confirm("Delete every entry on this device? Export a backup first if you might want them back.")) return;
    await db.entries.clear();
    setDataMsg("All entries deleted.");
  }

  const modelOptions = [...new Set([DEFAULT_MODEL, s.model, ...models])];

  return (
    <div className="settings">
      <header className="screen-head"><h1>Settings</h1></header>

      <section className="block">
        <h2 className="block-head">AI assistant</h2>
        <p>Lets you describe pain in your own words, asks a useful follow-up question, and writes report summaries. Everything else works without it.</p>

        <div className="choice" role="radiogroup" aria-label="Where AI runs">
          {AI_CHOICES.map((c) => (
            <label key={c.mode} className={`choice-item${shownMode === c.mode ? " is-on" : ""}`}>
              <input type="radio" name="ai-mode" checked={shownMode === c.mode} onChange={() => chooseMode(c.mode)} />
              <span>
                <span className="choice-title">{c.title}</span>
                <span className="choice-sub">{c.sub}</span>
              </span>
            </label>
          ))}
        </div>

        {shownMode === "device" && <DeviceAiSetup />}

        {shownMode === "gemini" && (
          <>
            <p className="muted">
              Your key is stored only in this browser. When you use an AI feature, what you typed and the related entries go
              straight from this device to Google. Nothing passes through Hurtly.
            </p>
            <label className="label" htmlFor="key">Gemini API key</label>
            <div className="key-row">
              <input
                id="key"
                className="input"
                type={show ? "text" : "password"}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder="Paste your key"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="button" className="btn btn-quiet" onClick={() => setShow(!show)}>{show ? "Hide" : "Show"}</button>
            </div>
            <p className="fine">
              No key yet? Create one free at{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.
            </p>
            <div className="row">
              <button type="button" className="btn btn-primary" onClick={connect} disabled={!keyDraft.trim() || status?.kind === "busy"}>
                {s.geminiKey && s.geminiKey === keyDraft.trim() ? "Check again" : "Save and connect"}
              </button>
              {s.geminiKey && <button type="button" className="btn btn-quiet btn-danger" onClick={forget}>Remove key</button>}
            </div>
            {status && <p className={status.kind === "error" ? "error" : "muted"} role="status">{status.text}</p>}

            {s.geminiKey && (
              <>
                <label className="label" htmlFor="model">Model</label>
                <select id="model" className="input" value={s.model} onChange={(e) => updateSettings({ model: e.target.value })}>
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>{m === DEFAULT_MODEL ? `${m} (recommended)` : m}</option>
                  ))}
                </select>
                {models.length === 0 && <p className="fine">Press "Check again" to load every model your key can use.</p>}
              </>
            )}
          </>
        )}
      </section>

      <section className="block">
        <h2 className="block-head">Your data</h2>
        <p className="muted">Entries are stored on this device only. Export a backup to move them to another device or keep a copy.</p>
        <div className="row">
          <button type="button" className="btn btn-quiet" onClick={exportBackup}>Export backup</button>
          <button type="button" className="btn btn-quiet" onClick={() => fileRef.current?.click()}>Restore from backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
        </div>
        <button type="button" className="btn btn-quiet btn-danger" onClick={wipe}>Delete all entries</button>
        {dataMsg && <p className="muted" role="status">{dataMsg}</p>}
      </section>

      <section className="block">
        <h2 className="block-head">About</h2>
        <p className="muted">
          Hurtly is a personal pain diary. It doesn't diagnose or give medical advice. If pain is sudden, severe or
          comes with other worrying symptoms, contact a medical professional or emergency services.
        </p>
        <p className="muted">
          Hurtly is free and open source under the AGPL-3.0 licence. Read the code, report a problem or suggest an idea{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">on GitHub</a>.
        </p>
      </section>
    </div>
  );
}
