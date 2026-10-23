import { useRef, useState } from "react";
import { DEFAULT_MODEL, updateSettings, useSettings } from "../lib/settings";
import { listModels } from "../lib/gemini";
import { allEntries, db, replaceAll } from "../lib/db";
import { download, parseBackup, toBackup } from "../lib/export";

export function SettingsScreen() {
  const s = useSettings();
  const [keyDraft, setKeyDraft] = useState(s.geminiKey);
  const [show, setShow] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "busy"; text: string } | null>(null);
  const [dataMsg, setDataMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function connect() {
    const key = keyDraft.trim();
    if (!key) return;
    setStatus({ kind: "busy", text: "Checking your key…" });
    try {
      const list = await listModels(key);
      setModels(list);
      updateSettings({ geminiKey: key, aiEnabled: true });
      setStatus({ kind: "ok", text: "Connected. AI features are on." });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : "Couldn't check the key." });
    }
  }

  function forget() {
    updateSettings({ geminiKey: "", aiEnabled: false });
    setKeyDraft("");
    setModels([]);
    setStatus(null);
  }

  async function exportBackup() {
    download(`bodytrace-backup-${new Date().toISOString().slice(0, 10)}.json`, toBackup(await allEntries()), "application/json");
  }

  async function importBackup(file: File) {
    try {
      const entries = parseBackup(await file.text());
      if (!confirm(`Replace everything on this device with ${entries.length} entries from this backup?`)) return;
      await replaceAll(entries);
      setDataMsg(`Restored ${entries.length} entries.`);
    } catch (e) {
      setDataMsg(e instanceof Error ? e.message : "Couldn't read that file.");
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
        <p>
          Lets you describe pain in your own words, suggests a quick follow-up question, and writes report summaries. It uses
          Google Gemini with <strong>your own API key</strong>.
        </p>
        <p className="muted">
          Your key is stored only in this browser. When you use an AI feature, what you typed and the related entries go
          straight from this device to Google — nothing passes through BodyTrace. Everything else works without it.
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
            <label className="check">
              <input type="checkbox" checked={s.aiEnabled} onChange={(e) => updateSettings({ aiEnabled: e.target.checked })} />
              <span>Use AI features</span>
            </label>
            <label className="label" htmlFor="model">Model</label>
            <select id="model" className="input" value={s.model} onChange={(e) => updateSettings({ model: e.target.value })}>
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m === DEFAULT_MODEL ? `${m} (recommended)` : m}</option>
              ))}
            </select>
            {models.length === 0 && <p className="fine">Press "Check again" to load every model your key can use.</p>}
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
          BodyTrace is a personal pain diary. It doesn't diagnose or give medical advice. If pain is sudden, severe or
          comes with other worrying symptoms, contact a medical professional or emergency services.
        </p>
      </section>
    </div>
  );
}
