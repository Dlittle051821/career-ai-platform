import "server-only";
import { createClient } from "../server";
import { trackEvent } from "../analytics/track";
import { validateBookDiscoverySession } from "@/lib/discovery-sessions/rules";
import type { DiscoverySession, DiscoverySessionContactMethod, DiscoverySessionStatus } from "@/types/discovery-session";

/**
 * Milestone 11-B1 — a logged-in student's own Discovery Session booking.
 * Fully student-owned on the read/insert side: RLS scopes both to
 * `auth.uid() = student_user_id` (supabase/migrations/0013_..._and_
 * recommendation_readiness.sql PART 2), so these functions never take a
 * student id parameter. Mirrors src/lib/supabase/education/saved-items.ts's
 * "return null/empty when logged out rather than throw" read convention.
 */

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const ACTIVE_STATUSES: DiscoverySessionStatus[] = ["requested", "scheduled"];

function logDbError(context: string, error: unknown) {
  console.error(`[discovery-sessions/book] ${context}:`, error);
}

interface DiscoverySessionRow {
  id: string;
  student_user_id: string;
  session_type: string;
  status: string;
  assigned_counsellor_id: string | null;
  preferred_contact_method: string | null;
  preferred_time_range: string | null;
  preferred_language: string | null;
  student_notes: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

function toDiscoverySession(row: DiscoverySessionRow, counsellorName: string | null = null): DiscoverySession {
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    studentName: null,
    studentEmail: null,
    sessionType: row.session_type as DiscoverySession["sessionType"],
    status: row.status as DiscoverySessionStatus,
    assignedCounsellorId: row.assigned_counsellor_id,
    assignedCounsellorName: counsellorName,
    preferredContactMethod: row.preferred_contact_method as DiscoverySessionContactMethod | null,
    preferredTimeRange: row.preferred_time_range,
    preferredLanguage: row.preferred_language,
    studentNotes: row.student_notes,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireUserId(supabase: ServerSupabase): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");
  return user.id;
}

/** Every Discovery Session the logged-in student has ever booked, newest first. Empty array when logged out. */
export async function listMyDiscoverySessions(): Promise<DiscoverySession[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("discovery_sessions")
    .select("*")
    .eq("student_user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) {
    logDbError("listMyDiscoverySessions", error);
    return [];
  }
  return (data ?? []).map((row) => toDiscoverySession(row));
}

/** The student's current active (requested/scheduled) Discovery Session, if any — the dashboard and booking-eligibility check both want just this one. */
export async function getMyActiveDiscoverySession(): Promise<DiscoverySession | null> {
  const sessions = await listMyDiscoverySessions();
  return sessions.find((s) => ACTIVE_STATUSES.includes(s.status)) ?? null;
}

export interface BookDiscoverySessionInput {
  preferredContactMethod: DiscoverySessionContactMethod | null;
  preferredTimeRange: string | null;
  preferredLanguage: string | null;
  studentNotes: string | null;
}

/**
 * Books a free Discovery Session for the logged-in student. Always
 * session_type='DISCOVERY_SESSION', status='requested', unassigned — the
 * RLS insert policy independently enforces the same shape (defense in
 * depth, not the only check — see validateBookDiscoverySession()).
 */
export async function bookDiscoverySession(input: BookDiscoverySessionInput): Promise<string> {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);

  const existing = await getMyActiveDiscoverySession();
  const check = validateBookDiscoverySession({ isAuthenticated: true, hasActiveSession: Boolean(existing) });
  if (!check.ok) throw new Error(check.reason);

  const { data, error } = await supabase
    .from("discovery_sessions")
    .insert({
      student_user_id: userId,
      session_type: "DISCOVERY_SESSION",
      status: "requested",
      assigned_counsellor_id: null,
      preferred_contact_method: input.preferredContactMethod,
      preferred_time_range: input.preferredTimeRange,
      preferred_language: input.preferredLanguage,
      student_notes: input.studentNotes,
      scheduled_at: null,
      completed_at: null,
      cancelled_at: null,
      cancellation_reason: null,
    })
    .select("id")
    .single();

  if (error) {
    logDbError("bookDiscoverySession", error);
    throw new Error(error.message);
  }

  void trackEvent({
    eventName: "discovery_session_booked",
    source: "discovery_session_booking_form",
    path: "/discovery-session/book",
    feature: "onboarding",
    entityType: "discovery_session",
    entityId: data.id,
  });

  return data.id;
}
