// Web Speech API is prefixed in Safari/Chrome and missing in Firefox; we only offer the mic where it exists.
type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

function ctor(): (new () => Rec) | undefined {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Rec) | undefined;
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && !!ctor();
}

export function listen(onText: (text: string, final: boolean) => void, onEnd: () => void): () => void {
  const C = ctor();
  if (!C) return () => {};
  const rec = new C();
  rec.lang = navigator.language || "en-US";
  rec.interimResults = true;
  rec.continuous = true;
  rec.onresult = (e) => {
    let text = "";
    let final = true;
    for (let i = 0; i < e.results.length; i++) {
      text += e.results[i][0].transcript;
      if (!e.results[i].isFinal) final = false;
    }
    onText(text, final);
  };
  rec.onend = onEnd;
  rec.onerror = onEnd;
  rec.start();
  return () => rec.stop();
}
