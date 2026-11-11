# CC25-06: Dependencies and payment safety

## 1. npm vulnerabilities

| | Before (`3d5e373`) | After (CC-25) |
|---|---|---|
| `npm audit` | 8 moderate in the cloud copy; 7 on the PC (advisory data differed by date) | **0 vulnerabilities** |

**Root cause (one advisory).** `minimatch` ≥7.0.0 <11.0.1, GHSA-g3hv-75wg-m249 / CVE-2026-118764.
- **What it is:** a denial of service. With `optimizationLevel ≥ 2`, a crafted glob pattern is amplified, and a quadratic pairwise comparison follows.
- **Fixed in:** minimatch 11.0.1.

**Path.** `eslint-config-next@16.4.5` → `typescript-eslint@8.67.0` → `@typescript-eslint/typescript-estree` → `minimatch@10.2.6`. The other 7 findings are this same chain.

**Exposure.**
- Dev-only: the ESLint toolchain.
- Not in the production bundle or any runtime path.
- An attacker would need to supply glob patterns to ESLint on a developer machine.
- The other `minimatch` copies (3.1.5, used by ESLint itself) are outside the affected range.

**Upstream status.** The newest `@typescript-eslint/typescript-estree` (8.72.2) still requires `minimatch ^10.2.2`, so a plain upgrade can't fix it. npm's own suggestion, `npm audit fix --force`, would *downgrade* `eslint-config-next` to 15.5.29, a breaking change, so it was **not** used.

**Fix applied (targeted).** One `overrides` entry in `package.json`:

```json
"overrides": { "@typescript-eslint/typescript-estree": { "minimatch": "^11.0.1" } }
```

Lockfile change:
- `minimatch` 10.2.6 → 11.0.8 under `typescript-estree` only;
- one new dev dependency, `@isaacs/nonrecursive-glob-match@1.1.0`.

The lockfile was edited to contain *only* that change. Regenerating it with the local npm would have dropped the `libc` platform fields, and npm 11 would have added unrelated WASM entries.

**Verified in a clean folder:**
- `npm ci` succeeds;
- `npm ls` shows `minimatch@11.0.8 overridden`;
- `npm audit` reports 0;
- ESLint output after the change is **identical** to before (§2).

**Risk.** minimatch 11 requires Node 20 or 22+. The project already builds on Node 22 or 24. If ESLint ever misbehaves, remove the override; it doesn't affect the application.

A `test:db-security` script was also added to `package.json` (§3 of CC25-03).

## 2. ESLint warnings

See §5.

## 3. Payment safety

Nextwise Verified costs **₹1,999 including applicable GST**. Payment collection stays **off**. CC-25 changed no payment code.

| ID | Check (what an attacker or a curious student would try) | Status | Evidence |
|---|---|---|---|
| G1–G8 | UI and server actions: Verified checkout offers no way to pay; direct calls to `confirmPricingPurchaseAction`, `createCheckoutSessionAction` and `verifyCheckoutAction` are refused; nothing is written; the free Discovery Session is still bookable | See CC25-04 | Suite G (CC-24 suite, re-run on the CC-25 build) |
| P1 | Anonymous `POST /rest/v1/rpc/purchase_pricing_plan` | **PASS** (refused) | Suite P |
| P2 | Signed-in student calls `purchase_pricing_plan` directly through the API | **PASS** with a **P2 note**: the database issues an **unpaid invoice of exactly ₹1,999 (199,900 paise, INR)**. No payment attempt and no gateway order. Paying still needs the gated server checkout, which is closed. | Suite P |
| P3 | Forged `verify_checkout_payment` | **PASS** (rejected) | Suite P |
| P4 | Forged Razorpay webhook (`apply_webhook_event`) | **PASS** (rejected: no secret configured, and the HMAC is required) | Suite P |
| P5 | Read `payment_gateway_config` (secrets) as anonymous and as a student | **PASS** (0 rows) | Suite P |
| P6 | No payment attempt, transaction or gateway order created by P1–P5 | **PASS** | Suite P |
| P7 | Build switches: no `NEXTWISE_PAID_CHECKOUT*`, `RAZORPAY_*`, OpenAI/Gemini/AI provider variables | **PASS** | Suite P |
| U1 | Tree-wide unit guards: every payment entry point checks the launch gate | **PASS** | `src/lib/payments/cc24-payment-safety.test.ts` and the CC-14 charge-guard tests (part of the Vitest run) |

**Unresolved (unchanged from CC-24, owned outside CC-25):**
- The GST tax and database dependencies: CC-19/CC-20 and NW01.
- Until they're approved and applied, checkout must stay closed.
- The CC-14 charge guard already refuses an incorrect Verified charge, such as the ₹2,358.82 defect, so the unresolved calculation **can't** produce a wrong charge.

## 4. Paid AI

- No AI provider variable is set in any CC-25 build or test.
- The CC-24 and NW-F01 guards are unchanged and pass in the full Vitest run.
- The proposed NW09.2 live OpenAI package stays unapplied.

## 5. ESLint result (final)

| | `3d5e373` (old minimatch) | CC-25 (override) |
|---|---|---|
| Errors | 0 | **0** |
| Warnings | 18 × `@next/next/no-img-element` | **the same 18** |

The two results are identical rule for rule and line for line (`evidence/eslint-base.json` vs `evidence/eslint-cc25.json`).

**Review of the 18 warnings.**
- Every one is `@next/next/no-img-element`, a performance hint to use `next/image`.
- They sit in 8 older hero and section components: book-counselling, careers, discovery session, Europe explorer, how-it-works, and three legacy home sections.
- None is in the 39 protected V5.4 files, and none is a security or correctness issue.
- Converting them to `next/image` changes image loading and sizing, so it needs visual-regression work.
- **Deliberately not changed** in CC-25, per the brief ("do not change protected visuals purely to eliminate noncritical warnings"). Recommended as a separate performance task.
