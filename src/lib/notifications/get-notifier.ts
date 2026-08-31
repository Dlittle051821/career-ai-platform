import { LoggingNotifier, type Notifier } from "./notifier";

/**
 * The one place application code asks "which Notifier should I use". Today
 * this always returns LoggingNotifier — see notifier.ts's own docblock for
 * the full explanation and exactly where a real implementation plugs in
 * (add a branch here, same shape as src/lib/signatures/get-provider.ts).
 */
let notifierSingleton: Notifier | null = null;

export function getNotifier(): Notifier {
  if (!notifierSingleton) notifierSingleton = new LoggingNotifier();
  return notifierSingleton;
}
