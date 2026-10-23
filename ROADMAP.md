# Roadmap

Where Hurtly is going, roughly in order. It's a hobby and mission project, so this is a direction, not a schedule. Want to help with something? Open an issue first so we can agree on the approach (see [CONTRIBUTING.md](CONTRIBUTING.md)).

Every feature is held to the same rules: **entries stay on the device, logging stays quick on a bad day, and nothing diagnoses.**

## Done

- [x] Paint where it hurts on a front/back figure, with arrows for pain that spreads, zoom, erase and undo
- [x] Intensity, what it feels like, pattern, triggers, what helps, what it gets in the way of, notes
- [x] Two-tap "Log again" and "No pain today" check-ins
- [x] History heat map, per-area timelines and trends
- [x] Printable report for a clinician, spreadsheet export, backup and restore
- [x] Optional AI: describe pain in your own words, follow-up questions, report summary, on the device or with your own Gemini key
- [x] Offline warnings for emergency signs
- [x] Installable app that works offline; light and dark themes

## Next

Small enough to pick up now.

- [ ] **Edit an entry.** Entries can only be deleted today.
- [ ] **Reminders** to check in, with sensible quiet hours (web push; on iPhone this works once the app is installed to the home screen).
- [ ] **Weather alongside entries** from Open-Meteo (free, no key), so "is it worse when it's cold or damp?" can be answered.
- [ ] **Medications:** what you took and whether it helped, kept with the entry.
- [ ] **App lock** with a PIN or the device's fingerprint or face unlock (passkeys).
- [ ] **"Since my last appointment"** view in the report: what's new, what's changed, what's better.
- [ ] **Low-energy mode:** one screen, big targets, log in five seconds.
- [ ] **End-to-end tests in CI** (Playwright) for painting, saving and the report.

## Later

Bigger pieces that need design work first.

### A better body figure
- [ ] Close-up drawings for hands and fingers, feet and toes, the jaw and face, and the pelvic floor
- [ ] Figures that match the person: amputation and phantom limb pain, wheelchair users, different body shapes
- [ ] Sex-specific areas (pelvic, breast, menstrual pain)
- [ ] A children's mode with the faces pain scale, so a parent can log for a child

### For clinicians
- [ ] Recognised questionnaires: Brief Pain Inventory (needs a licence), PROMIS pain interference, and condition-specific ones such as Oswestry (back) and HIT-6 (migraine)
- [ ] A secure, expiring share link to the report, encrypted so only the recipient can read it
- [ ] FHIR export, so the data can go into health records

### Your data, everywhere
- [ ] Encrypted backup to your own iCloud or Google Drive, with no Hurtly server
- [ ] Optional end-to-end encrypted sync between your devices

### Phone apps
- [ ] Native iPhone and Android apps from the same code (Capacitor)
- [ ] Apple Health and Google Health Connect: sleep, steps, heart rate, cycle, medications
- [ ] On-device AI on phones (Apple's on-device models, Gemini Nano on Android)
- [ ] Home-screen widgets, quick logging from a watch, voice assistant shortcuts

### Insights
- [ ] Links between pain and sleep, activity, weather and cycle, shown only when there's enough data to be honest about it

### Everyone
- [ ] Translations, including pain vocabulary, which differs between languages
- [ ] A full screen-reader and cognitive-load review with people who use them

## Known limitations

- Pinch-to-zoom hasn't been tested widely on real phones yet. Reports welcome.
- On-device AI currently needs desktop Chrome 148 or later. On phones, use Gemini with your own key or turn AI off.
- Entries live in one browser on one device. Moving them means exporting and importing a backup.

## Not planned

- Diagnosis or treatment suggestions. Hurtly keeps a record; clinicians interpret it.
- Ads, analytics or selling data.
