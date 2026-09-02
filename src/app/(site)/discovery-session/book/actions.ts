"use server";

import { revalidatePath } from "next/cache";
import { bookDiscoverySession, type BookDiscoverySessionInput } from "@/lib/supabase/discovery-sessions/book";

export interface BookDiscoverySessionResult {
  sessionId: string | null;
  error: string | null;
}

/** Called from the client booking form — mirrors createCheckoutSessionAction's (src/app/(site)/payments/actions.ts) "server action returns a result object, client manages its own local state" pattern rather than useActionState, since this form has no admin-style multi-field validation state to track. */
export async function bookDiscoverySessionAction(input: BookDiscoverySessionInput): Promise<BookDiscoverySessionResult> {
  try {
    const sessionId = await bookDiscoverySession(input);
    revalidatePath("/dashboard");
    revalidatePath("/discovery-session/book");
    return { sessionId, error: null };
  } catch (error) {
    return {
      sessionId: null,
      error: error instanceof Error ? error.message : "Could not book your Discovery Session. Please try again.",
    };
  }
}
