/**
 * Shared Server Action state shape for every admin create/edit form, used
 * with React 19's useActionState. A form either succeeds (the action
 * calls redirect(), which throws internally and never returns a state) or
 * fails and returns { error }, which the form redisplays via FormError.
 */
export interface ActionState {
  error: string | null;
}

export const INITIAL_ACTION_STATE: ActionState = { error: null };

/**
 * Maps a caught error to a short, honest, non-technical message — the
 * admin-system equivalent of src/lib/supabase/db-errors.ts's
 * friendlyDbError, extended to handle AdminAuthorizationError specially
 * (its message is already written to be safe to show directly) and
 * validation errors raised deliberately by an action (also safe to show
 * directly, since the action authored that message itself). Never surfaces
 * a raw Postgres/constraint error string, which could leak schema details.
 */
export function friendlyAdminError(error: unknown): string {
  if (error && typeof error === "object" && "name" in error) {
    const name = (error as { name: unknown }).name;
    if (name === "AdminAuthorizationError") {
      return error instanceof Error ? error.message : "You do not have permission to do this.";
    }
    if (name === "AdminValidationError") {
      return error instanceof Error ? error.message : "Please check the form and try again.";
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("jwt") || message.includes("session") || message.includes("not authenticated")) {
    return "Your session has expired. Please log in again to continue.";
  }
  if (message.includes("network") || message.includes("fetch failed")) {
    return "We couldn't reach the server. Please check your internet connection and try again.";
  }
  if (message.includes("violates row-level security") || message.includes("permission denied")) {
    return "You don't have permission to make this change.";
  }
  if (message.includes("violates check constraint") || message.includes("invalid input") || message.includes("out of range")) {
    return "One of the fields isn't in a valid format. Please review and try again.";
  }
  if (message.includes("violates unique constraint") || message.includes("duplicate key")) {
    return "A record with that value already exists.";
  }
  if (message.includes("violates foreign key constraint")) {
    return "One of the linked records no longer exists — please refresh and try again.";
  }

  return "Something went wrong saving your change. Please try again.";
}

/** Raised deliberately by a server action for a validation failure it wants shown verbatim (never a raw exception). */
export class AdminValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminValidationError";
  }
}
