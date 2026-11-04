import type { AiMode } from "./config";
import type { AiDataClass } from "./types";

/**
 * NW09 — which data may go to which provider. Checked before EVERY call,
 * independently of configuration, so a misconfiguration can never send a
 * real student's profile to the wrong service.
 *
 *  - mock:   local and deterministic; any data (nothing leaves the server).
 *  - gemini: FICTIONAL DATA ONLY. Google's Gemini API terms for unpaid
 *            services: "Do not submit sensitive, confidential, or personal
 *            information to the Unpaid Services" — prompts may be read by
 *            human reviewers and used to improve Google's products. The
 *            terms also require users to be 18+, and Nextwise serves school
 *            students, so Gemini stays a developer evaluation tool.
 *  - openai: real student data only once the paid provider is explicitly
 *            approved (AI_OPENAI_APPROVED) — which config.ts already requires
 *            before mode can be "openai" at all.
 */
export type DataPolicyDecision = { allowed: true } | { allowed: false; reason: string };

export function checkDataPolicy(mode: AiMode, dataClass: AiDataClass): DataPolicyDecision {
  switch (mode) {
    case "disabled":
      return { allowed: false, reason: "AI is disabled." };
    case "mock":
      return { allowed: true };
    case "gemini":
      return dataClass === "fictional"
        ? { allowed: true }
        : { allowed: false, reason: "Gemini (free tier) may only process fictional evaluation profiles — never a real student's information." };
    case "openai":
      return { allowed: true };
  }
}
