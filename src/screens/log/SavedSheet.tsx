import { useEffect, useState } from "react";
import { Sheet } from "../../components/Controls";
import { regionLabel } from "../../data/regions";
import { fallbackQuestions } from "../../data/questions";
import { followUpQuestions, type Question } from "../../lib/ai";
import { db } from "../../lib/db";
import type { Entry } from "../../lib/types";

interface Props {
  open: boolean;
  entry: Entry | null;
  history: Entry[];
  ai: boolean;
  onClose: () => void;
}

/** Confirms the save, then offers one or two optional follow-up questions. */
export function SavedSheet({ open, entry, history, ai, onClose }: Props) {
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [typing, setTyping] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!open || !entry) return;
    setQuestions(null);
    setAnswers({});
    setTyping({});
    const ctl = new AbortController();
    const offline = () => setQuestions(fallbackQuestions(entry, history));
    if (ai) followUpQuestions(entry, history, ctl.signal).then(setQuestions, () => !ctl.signal.aborted && offline());
    else offline();
    return () => ctl.abort();
    // History changes the moment we save; only fetch once per new entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id]);

  async function answer(i: number, text: string) {
    if (!entry || !questions || !text.trim()) return;
    const next = { ...answers, [i]: text.trim() };
    setAnswers(next);
    const followUps = Object.entries(next).map(([k, v]) => ({ question: questions[Number(k)].question, answer: v }));
    await db.entries.update(entry.id, { followUps });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Saved" footer={<button type="button" className="btn btn-primary btn-wide" onClick={onClose}>Done</button>}>
      {entry && (
        <p className="saved-line">
          {entry.regions.map(regionLabel).join(", ")}, {entry.intensity}/10
        </p>
      )}
      {questions === null && <p className="muted">Thinking of a quick question…</p>}
      {questions && questions.length > 0 && (
        <div className="followups">
          <p className="muted">Answering helps your history make sense later. Skip anything you like.</p>
          {questions.map((q, i) => (
            <div key={i} className="followup">
              <p className="followup-q">{q.question}</p>
              {answers[i] ? (
                <p className="followup-a">{answers[i]}</p>
              ) : (
                <>
                  <div className="chips">
                    {q.options.map((o) => (
                      <button key={o} type="button" className="chip" onClick={() => answer(i, o)}>{o}</button>
                    ))}
                  </div>
                  <input
                    className="input input-small"
                    placeholder="Or type an answer"
                    value={typing[i] ?? ""}
                    onChange={(e) => setTyping({ ...typing, [i]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && answer(i, typing[i] ?? "")}
                    aria-label={`Answer: ${q.question}`}
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
