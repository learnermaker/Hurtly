import type { Entry } from "./types";
import { regionLabel } from "../data/regions";

export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(entries: Entry[]): string {
  const header = ["date", "time", "type", "areas", "intensity", "feels like", "pattern", "worse with", "better with", "affects", "note", "follow-ups"];
  const rows = entries.map((e) => {
    const d = new Date(e.createdAt);
    return [
      d.toISOString().slice(0, 10),
      d.toTimeString().slice(0, 5),
      e.kind === "clear" ? "pain-free" : "pain",
      e.regions.map(regionLabel).join("; "),
      e.kind === "clear" ? "0" : String(e.intensity),
      e.qualities.join("; "),
      e.pattern ?? "",
      e.triggers.join("; "),
      e.relief.join("; "),
      e.impact.join("; "),
      e.note ?? "",
      e.followUps.map((f) => `${f.question} ${f.answer}`).join("; "),
    ].map(csvCell);
  });
  return [header, ...rows].map((r) => r.join(",")).join("\n");
}

export interface Backup {
  app: "hurtly";
  version: 1;
  exportedAt: string;
  entries: Entry[];
}

export function toBackup(entries: Entry[]): string {
  const b: Backup = { app: "hurtly", version: 1, exportedAt: new Date().toISOString(), entries };
  return JSON.stringify(b, null, 2);
}

export function parseBackup(text: string): Entry[] {
  const data = JSON.parse(text) as Partial<Backup>;
  // "bodytrace" backups come from before the app was renamed.
  const fromApp = (data as { app?: string }).app;
  if ((fromApp !== "hurtly" && fromApp !== "bodytrace") || !Array.isArray(data.entries)) throw new Error("This file isn't a Hurtly backup.");
  return data.entries.filter((e) => typeof e?.id === "string" && typeof e.createdAt === "number" && Array.isArray(e.regions));
}
