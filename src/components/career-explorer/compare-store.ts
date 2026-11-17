"use client";

import { useCallback, useSyncExternalStore } from "react";
import { COMPARE_STORAGE_KEY, sanitizeCompareEntries, toggleCompareEntry, type CompareEntry, type ToggleResult } from "@/lib/career-explorer/compare-selection";

/**
 * The comparison selection, shared by every toggle and the tray on a page.
 * Stored in this browser only (localStorage) — no account, no server call.
 * Storage can be unavailable (private mode, blocked): the selection then
 * simply lasts for the page.
 */
const CHANGE_EVENT = "nw:career-compare";
const EMPTY: CompareEntry[] = [];
let memory: CompareEntry[] = EMPTY;
let cacheRaw: string | null | undefined;
let cache: CompareEntry[] = EMPTY;

function read(): CompareEntry[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(COMPARE_STORAGE_KEY);
  } catch {
    return memory;
  }
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    cache = raw ? sanitizeCompareEntries(JSON.parse(raw)) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(entries: CompareEntry[]) {
  memory = entries;
  try {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable: keep the in-memory copy */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useCompareSelection() {
  const entries = useSyncExternalStore(subscribe, read, () => EMPTY);
  const toggle = useCallback((entry: CompareEntry): ToggleResult["status"] => {
    const result = toggleCompareEntry(read(), entry);
    if (result.status !== "full") write(result.entries);
    return result.status;
  }, []);
  const remove = useCallback((slug: string) => write(read().filter((e) => e.slug !== slug)), []);
  const clear = useCallback(() => write([]), []);
  return { entries, toggle, remove, clear };
}
