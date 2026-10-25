import "server-only";
import { createClient } from "../server";
import type { RecommendationDraftContent } from "@/lib/recommendations/drafts";

/**
 * NW07.6 — Recommendation Workflow. Student-facing orchestration — READ
 * ONLY, for the student's own RELEASED reports. Every read goes through
 * get_my_recommendation_reports()/get_my_recommendation_report_content()
 * (supabase/migrations-proposed/NW07_counsellor_studio_foundation.sql PART
 * 2) — this file never reads `recommendation_drafts`/
 * `recommendation_draft_versions` directly, matching
 * education/application-tasks.ts's own "zero direct student RLS access"
 * convention (here there is in fact ZERO student RLS at all — these two
 * RPCs are the entire access surface). There is no student WRITE path
 * anywhere in this file, or anywhere in this feature — a student can read
 * a released report; nothing else.
 */

function logDbError(context: string, error: unknown) {
  console.error(`[education/recommendation-reports] ${context}:`, error);
}

export interface MyRecommendationReportSummary {
  id: string;
  title: string;
  recommendationType: string | null;
  releasedAt: string | null;
  updatedAt: string;
}

interface MyRecommendationReportSummaryRow {
  id: string;
  title: string;
  recommendation_type: string | null;
  released_at: string | null;
  updated_at: string;
}

/** The student's own list of RELEASED recommendation reports only. Returns `[]` (never throws) for a logged-out caller or any RPC error. */
export async function listMyRecommendationReports(): Promise<MyRecommendationReportSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_my_recommendation_reports");
  if (error) {
    logDbError("listMyRecommendationReports", error);
    return [];
  }
  return ((data ?? []) as unknown as MyRecommendationReportSummaryRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    recommendationType: row.recommendation_type,
    releasedAt: row.released_at,
    updatedAt: row.updated_at,
  }));
}

export interface MyRecommendationReportContent {
  id: string;
  title: string;
  recommendationType: string | null;
  content: RecommendationDraftContent;
  releasedAt: string | null;
}

interface MyRecommendationReportContentRow {
  id: string;
  title: string;
  recommendation_type: string | null;
  content: unknown;
  released_at: string | null;
}

/** The full content of one of the student's own RELEASED reports. Returns `null` for a report that isn't theirs, isn't released, or doesn't exist — never an error that would distinguish the three (anti-enumeration), matching the RPC's own documented behaviour. */
export async function getMyRecommendationReportContent(draftId: string): Promise<MyRecommendationReportContent | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("get_my_recommendation_report_content", { p_draft_id: draftId });
  if (error) {
    logDbError("getMyRecommendationReportContent", error);
    return null;
  }
  const row = ((data ?? []) as unknown as MyRecommendationReportContentRow[])[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    recommendationType: row.recommendation_type,
    content: (row.content as RecommendationDraftContent) ?? {},
    releasedAt: row.released_at,
  };
}
