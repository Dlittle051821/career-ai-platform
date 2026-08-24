/**
 * Maps a raw Supabase/PostgreSQL error to a short, honest, non-technical
 * message — used by every Milestone 3 save action. Never show a student a
 * raw exception, constraint name, or SQL fragment.
 */
export function friendlyDbError(error: unknown): string {
  const message = errorMessage(error).toLowerCase();

  if (message.includes("jwt") || message.includes("session") || message.includes("not authenticated")) {
    return "Your session has expired. Please log in again to continue.";
  }
  if (message.includes("network") || message.includes("fetch failed") || message.includes("failed to fetch")) {
    return "We couldn't reach the server. Please check your internet connection and try again.";
  }
  if (message.includes("violates row-level security") || message.includes("permission denied")) {
    return "We couldn't save your changes — you may need to log in again.";
  }
  if (message.includes("violates check constraint") || message.includes("out of range") || message.includes("invalid input")) {
    return "One of your answers isn't in a valid format. Please review this section and try again.";
  }
  if (message.includes("missing supabase environment variables")) {
    return "The site isn't connected to its account system yet. Please contact support.";
  }

  return "We couldn't save your changes. Please try again.";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
}
