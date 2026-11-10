import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Checkbox } from "@/components/forms/Checkbox";

/**
 * CC-23 regressions for the student auth forms. The full behaviour is covered
 * by the browser journeys (B2, B5); these lock the source-level fixes.
 */
const root = process.cwd();
const src = (p: string) => readFileSync(join(root, p), "utf8");

describe("CC-23: form errors are announced to screen readers", () => {
  it("Checkbox links its error message with aria-describedby", () => {
    const html = renderToStaticMarkup(createElement(Checkbox, { id: "register-terms", label: "I agree", error: "You need to agree to continue." }));
    expect(html).toContain('aria-describedby="register-terms-error"');
    expect(html).toContain('id="register-terms-error"');
    expect(html).toContain('aria-invalid="true"');
  });

  it("Checkbox keeps a caller-provided description alongside the error", () => {
    const html = renderToStaticMarkup(createElement(Checkbox, { id: "c", label: "x", error: "e", "aria-describedby": "c-hint" }));
    expect(html).toContain('aria-describedby="c-hint c-error"');
  });

  it("Checkbox without an error has no dangling description", () => {
    const html = renderToStaticMarkup(createElement(Checkbox, { id: "c", label: "x" }));
    expect(html).not.toContain("aria-describedby");
  });

  it.each([
    ["src/components/sections/auth/RegisterForm.tsx", "register-password"],
    ["src/components/sections/auth/LoginForm.tsx", "login-password"],
    ["src/components/sections/auth/ResetPasswordForm.tsx", "reset-password"],
    ["src/components/sections/book-counselling/BookingForm.tsx", "booking-phone"],
  ])("%s links the wrapped %s input to its error explicitly", (file, id) => {
    const s = src(file);
    const block = new RegExp(`<Input\\s+id="${id}"[\\s\\S]{0,400}`).exec(s)?.[0] ?? "";
    expect(block).toMatch(new RegExp(`aria-describedby=\\{describedBy\\([^)]*"${id}-error"`));
  });
});

describe("CC-23: registration does not reveal whether an email has an account", () => {
  const s = src("src/components/sections/auth/RegisterForm.tsx");
  it("does not show the 'may already exist' message for an obfuscated sign-up", () => {
    expect(s).not.toContain("setFormError(ALREADY_REGISTERED_MESSAGE)");
    expect(s).not.toMatch(/identities\.length === 0\)\s*\{\s*setFormError/);
  });
  it("the shared 'check your email' screen is honest for new and existing emails", () => {
    expect(s).toContain("is new to Nextwise, we&apos;ve sent it a");
    expect(s).toContain("If you already have a Nextwise account with this email, no new link is sent");
  });
});
