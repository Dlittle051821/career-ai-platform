/**
 * CC-22B — after a client-side validation failure, move keyboard and screen
 * reader focus to the first field the form marked invalid. Runs after React
 * has committed the error state (aria-invalid is set during that render).
 */
export function focusFirstInvalidField(form: HTMLFormElement | null): void {
  if (!form || typeof window === "undefined") return;
  window.setTimeout(() => {
    const first = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    first?.focus();
  }, 0);
}
