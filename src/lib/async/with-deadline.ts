/**
 * Resolves with the promise's value, or rejects with DeadlineError once `ms`
 * has passed. Used so a pending request can never leave the interface waiting
 * forever. The underlying work is not cancelled; its late result is ignored.
 */
export class DeadlineError extends Error {
  constructor() {
    super("deadline exceeded");
    this.name = "DeadlineError";
  }
}

export function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineError()), ms);
  });
  return Promise.race([promise, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
