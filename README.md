# BodyTrace

Mark where it hurts, describe it in plain words, and keep a history your clinician can read.

BodyTrace is a personal pain diary that installs on your phone. It's built around one loop:

1. **Mark it.** Paint where it hurts on a front/back body figure with your finger, draw arrows where it spreads, and pinch to zoom for small areas. Or say it in your own words ("burning in my lower right back, about a 6, worse when I sit").
2. **Describe it.** Choose a 0–10 intensity and what it feels like. More detail (pattern, what makes it worse or better, what it gets in the way of) is optional.
3. **Watch it change.** Each area gets its own timeline: when it started, typical and worst intensity, and whether it's getting worse, easing or holding steady.
4. **Share it.** A one-page report you can print or save as a PDF for a doctor or physio, plus a spreadsheet export.

Logging a known area again takes two taps ("Log again"), and "No pain today" check-ins keep good days in the record, not just bad ones.

## Privacy: local-first, AI on your terms

- **Your entries stay on your device** (IndexedDB). There's no account and no server. Export a backup from Settings to move them to another device.
- **AI is optional.** Choose in Settings where it runs:
  - **On this device:** the browser's built-in model (Chrome's Prompt API, desktop Chrome 148+). It's free and private, and nothing you type leaves the device. The model downloads once.
  - **Gemini with your own key:** works in any browser. Paste a key from [Google AI Studio](https://aistudio.google.com/apikey); it's stored only in your browser, and requests go straight from your device to Google.
  - **Off:** built-in follow-up questions instead.

What the AI does:

| Feature | Without AI | With AI |
|---|---|---|
| Logging | Paint on the body figure or search areas | Also: describe it by voice or text and the form fills itself; you check it before saving |
| Follow-up questions | A fixed set of plain-language questions | 1–2 questions based on your history ("Last time you said it spread to your leg…") |
| Report | Tables, body map, your notes | Also: a short summary written in your words, plus questions to ask your clinician |

The AI never diagnoses or suggests treatment, and anything it returns is checked against the app's own lists before it's used. Safety guidance for emergency warning signs (for example, crushing chest pain) comes from fixed rules that work offline.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run build      # type-check and build the PWA into dist/
```

Stack: React 19, TypeScript, Vite, Dexie (IndexedDB), vite-plugin-pwa. The build is a static site and runs from any static host or sub-path.

```
src/
  data/regions.ts     the body figure outline, landmarks and area zones (left/right handled per view)
  lib/mask.ts         painted areas as a grid over the figure; areas are worked out from the paint
  components/BodyCanvas.tsx  painting, arrows, pinch-zoom, heat maps
  data/questions.ts   offline follow-up questions
  lib/ai.ts           Gemini prompts and checks on everything the AI returns
  lib/gemini.ts       minimal BYOK Gemini REST client
  lib/ondevice.ts     the browser's built-in model (Prompt API)
  lib/stats.ts        per-area summaries, trends, daily series
  lib/safety.ts       offline emergency-warning rules
  screens/log/        Log screen, its sheets, and the paint editor hook
  screens/            History, Area detail, Report, Settings
```

## Not medical advice

BodyTrace is a personal record. It doesn't diagnose or give medical advice. If pain is sudden or severe, or comes with other worrying symptoms, contact a medical professional or emergency services.
