import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { allEntries } from "./db";
import { daysAgo } from "./format";
import { inRange } from "./stats";
import type { Entry } from "./types";

/** All entries, oldest first; undefined while the first read is in flight. */
export function useEntries(): Entry[] | undefined {
  return useLiveQuery(allEntries);
}

/** Entries from the last `days` days (0 = everything). */
export function useRecentEntries(days: number): { all: Entry[] | undefined; scoped: Entry[] } {
  const all = useEntries();
  const scoped = useMemo(() => (!all ? [] : days ? inRange(all, daysAgo(days)) : all), [all, days]);
  return { all, scoped };
}
