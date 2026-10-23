import { useSyncExternalStore } from "react";

export interface Route {
  tab: "log" | "history" | "report" | "settings";
  /** Extra path segments, e.g. ["region", "knee-l"]. */
  rest: string[];
  params: URLSearchParams;
}

function parse(hash: string): Route {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [tab, ...rest] = path.split("/").filter(Boolean);
  const valid = ["log", "history", "report", "settings"] as const;
  return {
    tab: (valid as readonly string[]).includes(tab) ? (tab as Route["tab"]) : "log",
    rest: rest.map(decodeURIComponent),
    params: new URLSearchParams(query),
  };
}

export function navigate(to: string): void {
  window.location.hash = to.startsWith("#") ? to : `#/${to}`;
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(
    (l) => {
      window.addEventListener("hashchange", l);
      return () => window.removeEventListener("hashchange", l);
    },
    () => window.location.hash,
  );
  return parse(hash);
}
