import "server-only";
import type { createClient } from "../server";
import type { Json } from "@/types/database";

/**
 * CC-25 — typed calls to the two RPCs added by the proposed migration
 * 0023 CC-25 (supabase/migrations-proposed/cc25). They are typed here,
 * not in src/types/database.ts, because that file is a protected CC-18
 * security file that must stay byte-identical. Both calls run with the
 * caller's own session (RLS and the functions' own checks apply); nothing
 * here uses the service role.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface RpcError {
  code?: string | null;
  message: string;
}

export interface StudentIdentityRow {
  session_id: string;
  student_user_id: string;
  full_name: string | null;
  email: string | null;
}

type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;

function rpc(supabase: Supabase): UntypedRpc {
  const call = supabase.rpc as unknown as UntypedRpc;
  return (fn, args) => call.call(supabase, fn, args);
}

/** staff_discovery_session_student_identities(p_session_ids uuid[]) — name and email only. */
export async function rpcStudentIdentities(
  supabase: Supabase,
  sessionIds: string[]
): Promise<{ data: StudentIdentityRow[] | null; error: RpcError | null }> {
  const { data, error } = await rpc(supabase)("staff_discovery_session_student_identities", { p_session_ids: sessionIds });
  return { data: (data as StudentIdentityRow[] | null) ?? null, error };
}

/** admin_set_discovery_session_assignment_approval(p_session_id, p_counsellor_id, p_approved). */
export async function rpcSetAssignmentApproval(
  supabase: Supabase,
  args: { sessionId: string; counsellorId: string; approved: boolean }
): Promise<{ data: Json | null; error: RpcError | null }> {
  const { data, error } = await rpc(supabase)("admin_set_discovery_session_assignment_approval", {
    p_session_id: args.sessionId,
    p_counsellor_id: args.counsellorId,
    p_approved: args.approved,
  });
  return { data: (data as Json | null) ?? null, error };
}
