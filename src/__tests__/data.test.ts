import { addEntry, allEntries, db, lastEntryFor, replaceAll } from "../lib/db";
import { parseBackup, toBackup, toCsv } from "../lib/export";
import { emptyDraft } from "../lib/types";

beforeEach(() => db.entries.clear());

describe("storage", () => {
  it("finds the latest entry for an area via the multi-entry index", async () => {
    await addEntry({ ...emptyDraft(["knee-l", "hip-l"]), kind: "pain", followUps: [], createdAt: 1, intensity: 3 });
    await addEntry({ ...emptyDraft(["knee-l"]), kind: "pain", followUps: [], createdAt: 2, intensity: 6 });
    expect((await lastEntryFor("knee-l"))?.intensity).toBe(6);
    expect((await lastEntryFor("hip-l"))?.intensity).toBe(3);
    expect(await lastEntryFor("head")).toBeUndefined();
  });

  it("round-trips a backup", async () => {
    await addEntry({ ...emptyDraft(["head"]), kind: "pain", followUps: [{ question: "Q", answer: "A" }], note: 'said "ouch", then sat' });
    const json = toBackup(await allEntries());
    await db.entries.clear();
    await replaceAll(parseBackup(json));
    const back = await allEntries();
    expect(back).toHaveLength(1);
    expect(back[0].followUps[0].answer).toBe("A");
  });

  it("rejects files that aren't backups", () => {
    expect(() => parseBackup('{"hello":1}')).toThrow(/isn't a BodyTrace backup/);
  });

  it("quotes CSV cells that contain commas or quotes", async () => {
    const e = await addEntry({ ...emptyDraft(["head"]), kind: "pain", followUps: [], note: 'said "ouch", then sat' });
    const csv = toCsv([e]);
    expect(csv.split("\n")[1]).toContain('"said ""ouch"", then sat"');
    expect(csv).toContain("Head / face");
  });
});
