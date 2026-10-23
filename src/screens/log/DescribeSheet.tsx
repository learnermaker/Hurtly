import { useEffect, useState } from "react";
import { Sheet } from "../../components/Controls";
import { parseDescription } from "../../lib/ai";
import { errorText } from "../../lib/format";
import { listen, speechSupported } from "../../lib/speech";
import type { Draft } from "../../lib/types";

interface Props {
  open: boolean;
  ai: boolean;
  onClose: () => void;
  onParsed: (draft: Draft, regions: string[]) => void;
}

export function DescribeSheet({ open, ai, onClose, onParsed }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stopListening, setStopListening] = useState<null | (() => void)>(null);

  useEffect(() => {
    if (open) return;
    stopListening?.();
    setStopListening(null);
    setError(null);
    // Only react to the sheet closing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleMic() {
    if (stopListening) {
      stopListening();
      setStopListening(null);
      return;
    }
    const before = text ? text.trimEnd() + " " : "";
    const stop = listen(
      (t) => setText(before + t),
      () => setStopListening(null),
    );
    setStopListening(() => stop);
  }

  async function fill() {
    stopListening?.();
    setBusy(true);
    setError(null);
    try {
      const p = await parseDescription(text);
      if (p.regions.length === 0) {
        setError('I couldn\'t tell which part of the body you mean. Add where it hurts, like "left knee" or "lower back".');
        return;
      }
      onParsed(
        {
          intensity: p.intensity ?? 4,
          qualities: p.qualities,
          pattern: p.pattern ?? undefined,
          triggers: p.triggers,
          relief: p.relief,
          impact: p.impact,
          note: p.note || undefined,
          source: "describe",
        },
        p.regions,
      );
      setText("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Tell it in your words"
      footer={
        ai && (
          <button type="button" className="btn btn-primary btn-wide" disabled={busy || text.trim().length < 3} onClick={fill}>
            {busy ? "Reading…" : "Fill in the details"}
          </button>
        )
      }
    >
      {ai ? (
        <>
          <p className="muted">Say where it hurts, what it feels like, and anything that makes it better or worse. You'll check everything before it's saved.</p>
          <div className="describe-box">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder="My lower right back has been burning since this morning, about a 6. Worse when I sit, better when I walk."
              aria-label="Describe your pain"
            />
            {speechSupported() && (
              <button type="button" className={`mic${stopListening ? " is-on" : ""}`} onClick={toggleMic} aria-label={stopListening ? "Stop dictation" : "Dictate"}>
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path d="M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5 11a7 7 0 0014 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <p className="fine">Sent to Gemini with your own key.</p>
        </>
      ) : (
        <div className="empty">
          <p>Describing pain in your own words uses Gemini with your own API key. Add a key in Settings to turn it on.</p>
          <p className="muted">You can always paint on the body instead. It works offline.</p>
          <a className="btn btn-primary" href="#/settings" onClick={onClose}>Open Settings</a>
        </div>
      )}
    </Sheet>
  );
}
