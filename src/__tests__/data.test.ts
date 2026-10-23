import { addEntry, allEntries, db, lastEntryFor, replaceAll } from "../lib/db";
import { parseBackup, toBackup, toCsv } from "../lib/export";
import { makeEntry } from "./helpers";

beforeEach(() => db.entries.clear());

it("finds the latest entry for an area via the multi-area index", async () => {
  await addEntry(makeEntry({ regions: ["knee-l", "hip-l"], createdAt: 1, intensity: 3 }));
  await addEntry(makeEntry({ regions: ["knee-l"], createdAt: 2, intensity: 6 }));
  expect((await lastEntryFor("knee-l"))?.intensity).toBe(6);
  expect((await lastEntryFor("hip-l"))?.intensity).toBe(3);
});

it("round-trips a backup and rejects other files", async () => {
  await addEntry(makeEntry({ regions: ["head"], followUps: [{ question: "Q", answer: "A" }] }));
  const json = toBackup(await allEntries());
  await replaceAll(parseBackup(json));
  expect((await allEntries())[0].followUps[0].answer).toBe("A");
  expect(() => parseBackup('{"hello":1}')).toThrow(/isn't a BodyTrace backup/);
});

it("quotes CSV cells that contain commas or quotes", () => {
  const csv = toCsv([makeEntry({ regions: ["head"], note: 'said "ouch", then sat' })]);
  expect(csv.split("\n")[1]).toContain('"said ""ouch"", then sat"');
  expect(csv).toContain("Head / face");
});
