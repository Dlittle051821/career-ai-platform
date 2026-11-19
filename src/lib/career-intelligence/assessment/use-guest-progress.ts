"use client";

import { useMemo, useSyncExternalStore } from "react";
import { GUEST_PROGRESS_EVENT, parseGuestProgress, readGuestProgressRaw, type GuestProgress } from "./guest-store";

function subscribe(onChange: () => void) {
  window.addEventListener(GUEST_PROGRESS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(GUEST_PROGRESS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * This device's saved assessment progress. `undefined` while the page is
 * rendering on the server or hydrating (nothing is known yet), `null` when
 * there is none.
 */
export function useGuestProgress(): GuestProgress | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readGuestProgressRaw, () => undefined);
  return useMemo(() => (raw === undefined ? undefined : parseGuestProgress(raw)), [raw]);
}
