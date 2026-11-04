/**
 * NW09 — rate and budget decision. Pure: the server I/O layer reads the
 * counters (from the ai_generation_runs ledger) and asks this function;
 * the same rule is enforced again, atomically, inside the proposed
 * reserve RPC so two simultaneous requests cannot both slip under a limit.
 */
import type { AiLimits } from "./config";

export interface UsageCounters {
  staffToday: number;
  studentToday: number;
  globalToday: number;
  monthCostUsd: number;
}

export type BudgetDecision = { allowed: true } | { allowed: false; reason: string; code: "staff_daily" | "student_daily" | "global_daily" | "monthly_budget" };

export function checkBudget(counters: UsageCounters, limits: AiLimits, worstCaseCostUsd: number): BudgetDecision {
  if (counters.staffToday >= limits.perStaffDaily) return { allowed: false, code: "staff_daily", reason: `You have reached today's limit of ${limits.perStaffDaily} AI analyses.` };
  if (counters.studentToday >= limits.perStudentDaily) return { allowed: false, code: "student_daily", reason: `This student has reached today's limit of ${limits.perStudentDaily} AI analyses.` };
  if (counters.globalToday >= limits.globalDaily) return { allowed: false, code: "global_daily", reason: "The organisation's daily AI limit has been reached." };
  if (counters.monthCostUsd + worstCaseCostUsd > limits.monthlyBudgetUsd) return { allowed: false, code: "monthly_budget", reason: "This month's AI budget would be exceeded." };
  return { allowed: true };
}
