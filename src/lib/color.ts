// Sequential scale from pale amber to deep plum; lightness falls with intensity so it reads without hue.
const STOPS = ["#f3dc9a", "#f0c06c", "#eba04c", "#e3803a", "#d6602f", "#c4452c", "#ad302f", "#93223a", "#771a42", "#5c1545", "#43103f"];

export function intensityColor(n: number): string {
  return STOPS[Math.max(0, Math.min(10, Math.round(n)))];
}

/** Text colour that stays readable on top of intensityColor(n). */
export function intensityInk(n: number): string {
  return n >= 5 ? "#fff" : "#2a1a0c";
}
