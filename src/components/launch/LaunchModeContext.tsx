"use client";

import { createContext, useContext } from "react";
import { FULL_PLATFORM, type LaunchMode } from "@/lib/launch/launch-mode";

/**
 * V5.6.2 public launch. The server reads the launch mode (src/lib/launch/launch-mode.ts)
 * and hands it to client components through this context. It only changes what the
 * browser shows and requests; the server enforces the mode in middleware.ts.
 * Without a provider (admin, counsellor and studio layouts) the mode is full platform.
 */
const LaunchModeContext = createContext<LaunchMode>(FULL_PLATFORM);

export function LaunchModeProvider({ mode, children }: { mode: LaunchMode; children: React.ReactNode }) {
  return <LaunchModeContext.Provider value={mode}>{children}</LaunchModeContext.Provider>;
}

export function useLaunchMode(): LaunchMode {
  return useContext(LaunchModeContext);
}
