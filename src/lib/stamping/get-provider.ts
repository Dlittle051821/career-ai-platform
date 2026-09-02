import "server-only";
import type { StampProvider } from "./provider";
import { MockStampProvider } from "./mock-provider";
import { getStampProviderName } from "./config";

/**
 * Milestone 11-A (F-123) — resolves STAMP_PROVIDER to a real StampProvider
 * instance. Mirrors src/lib/signatures/get-provider.ts exactly. Today only
 * 'mock' is implemented — this milestone ships no real e-stamping provider
 * integration (see docs/milestones/M11-electronic-stamping-assisted-onboarding.md
 * "Future provider integration" for exactly how one plugs in here later: add
 * a new `case` below returning a new adapter class that implements
 * src/lib/stamping/provider.ts's StampProvider interface). Any unrecognized
 * provider name falls back to mock rather than crashing — matches this
 * codebase's "the app must run with none of these set" posture.
 *
 * Returns a process-wide singleton mock instance (not a fresh one per
 * call) — same reasoning and same KNOWN LIMITATION as
 * src/lib/signatures/get-provider.ts's mockProviderSingleton: "Request
 * E-Stamp" and a later "Retry"/"Cancel" happen in separate HTTP requests,
 * so the mock provider needs its in-memory map to survive between calls
 * within the same running process. The DATABASE (stamp_requests) is always
 * the actual source of truth for this application's own UI and
 * authorization decisions.
 */
let mockProviderSingleton: MockStampProvider | null = null;

export function getStampProvider(): StampProvider {
  const name = getStampProviderName();
  switch (name) {
    case "mock":
    default:
      if (!mockProviderSingleton) mockProviderSingleton = new MockStampProvider();
      return mockProviderSingleton;
  }
}
