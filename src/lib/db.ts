import Dexie, { type EntityTable } from "dexie";
import type { Entry } from "./types";

export const db = new Dexie("bodytrace") as Dexie & {
  entries: EntityTable<Entry, "id">;
};

db.version(1).stores({
  entries: "id, createdAt, kind, *regions",
});

export function newId(): string {
  return crypto.randomUUID();
}

export async function addEntry(entry: Omit<Entry, "id" | "createdAt"> & { createdAt?: number }): Promise<Entry> {
  const full: Entry = { ...entry, id: newId(), createdAt: entry.createdAt ?? Date.now() };
  await db.entries.add(full);
  return full;
}

export async function allEntries(): Promise<Entry[]> {
  return db.entries.orderBy("createdAt").toArray();
}

export async function lastEntryFor(regionId: string): Promise<Entry | undefined> {
  const list = await db.entries.where("regions").equals(regionId).sortBy("createdAt");
  return list.at(-1);
}

export async function replaceAll(entries: Entry[]): Promise<void> {
  await db.transaction("rw", db.entries, async () => {
    await db.entries.clear();
    await db.entries.bulkAdd(entries);
  });
}
