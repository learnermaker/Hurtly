import type { Draft } from "./types";
import { REGION_BY_ID } from "../data/regions";

/**
 * Plain rule checks that run offline, before any AI. They never block saving;
 * they surface guidance when a combination can signal an emergency.
 */
export function safetyNotice(d: Pick<Draft, "regions" | "intensity" | "qualities" | "note">): string | null {
  const groups = new Set(d.regions.map((r) => REGION_BY_ID[r]?.group));
  const text = (d.note ?? "").toLowerCase();

  if (groups.has("chest") && (d.intensity >= 6 || /breath|sweat|jaw|crushing|pressure/.test(text))) {
    return "Chest pain that feels crushing or tight, or comes with shortness of breath, sweating, or pain spreading to your arm, back or jaw, needs emergency care now. Call your local emergency number.";
  }
  if (groups.has("head") && (d.intensity >= 9 || /worst|sudden|thunderclap/.test(text))) {
    return "A sudden, severe headache — especially the worst you've ever had, or with confusion, a stiff neck, or trouble speaking or seeing — needs emergency care now.";
  }
  if (groups.has("back") && /bladder|bowel|saddle|groin numb/.test(text)) {
    return "Back pain with new numbness around the groin or trouble controlling your bladder or bowels needs urgent medical attention today.";
  }
  if (d.qualities.includes("numb") && /face|droop|speech|slurred|one side/.test(text)) {
    return "Sudden numbness or weakness on one side, a drooping face or slurred speech can be signs of a stroke. Call your local emergency number now.";
  }
  return null;
}
