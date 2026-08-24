/**
 * Maps raw Supabase Auth errors to short, honest, non-technical messages.
 * We never show the student a raw exception message or JSON — but we also
 * never claim something false (e.g. we don't say "no account found" for a
 * wrong password, since email enumeration on login is a separate,
 * deliberate design choice — see friendlyLoginError below).
 */
export function friendlyAuthError(error: unknown): string {
  const message = errorMessage(error).toLowerCase();

  if (message.includes("user already registered") || message.includes("already been registered")) {
    return "An account with this email already exists. Try logging in instead, or use “Forgot password” if you don’t remember your password.";
  }
  if (message.includes("password should be at least") || message.includes("password is too short")) {
    return "Please choose a longer password (at least 8 characters).";
  }
  if (message.includes("invalid email")) {
    return "That doesn’t look like a valid email address.";
  }
  if (message.includes("invalid login credentials")) {
    return "Email or password is incorrect.";
  }
  if (message.includes("email not confirmed")) {
    return "Please confirm your email address first — check your inbox for a confirmation link.";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (message.includes("expired") || message.includes("invalid or expired")) {
    return "This link has expired. Please request a new one.";
  }
  if (message.includes("network") || message.includes("fetch failed") || message.includes("failed to fetch")) {
    return "We couldn’t reach the server. Please check your internet connection and try again.";
  }
  if (message.includes("missing supabase environment variables")) {
    return "The site isn’t connected to its account system yet. Please contact support.";
  }

  return "Something went wrong. Please try again in a moment.";
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}
