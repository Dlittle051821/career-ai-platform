# NW09.2: OpenAI live integration (Counsellor Studio AI Career Intelligence)

Status: **prepared, not activated.** No paid request has been made by the developer. Real AI stays off until the steps below are done by hand.

## What changed

| Area | Change |
|---|---|
| Provider | The OpenAI adapter uses the official Node SDK (Responses API). The client is pinned to `https://api.openai.com/v1`, SDK retries are off, and requests are sent with `store: false`. Output uses strict `json_schema`, with `parallel_tool_calls: false` and `truncation: "disabled"`. The request carries no tools, no web search and no conversation state. |
| Model | Set explicitly with `AI_OPENAI_MODEL`. There is **no default model for paid calls**. The verified pilot model is `gpt-6.1-terra` (official model and pricing pages, 6 Nov 2026). If a response names a different model, the call is recorded as a failure (`model_mismatch`); a dated snapshot of the configured model counts as the same model. |
| Errors | Each error falls into one category: `auth` (401/403), `billing` (insufficient_quota, credit_balance_exhausted, organisation/project spend or usage limits), `model_unavailable` (404, model_not_found), `rate_limited` (429 slow-down), `timeout`, `unavailable` (5xx/connection) or `bad_request`. The provider's own message text is never copied. |
| Retries | Paid provider: at most 2 attempts, and the second one only for `rate_limited` or `unavailable`. Timeouts, invalid JSON, schema failures, refusals and incomplete answers are **never** retried. The live pilot script forces exactly 1 attempt. |
| Output (schema v2) | Profile interpretation; 3–5 catalogue careers, each with evidence, skills shown, gaps, trade-offs, reasons it may not suit, pathways and next steps; a written comparison (no AI scores); academic direction (fields of study only, no institutions); a development plan; missing information and questions; and AI observations kept apart from the counsellor's rationale. Every career is joined back to the Nextwise catalogue, and anything that is not in it is dropped. Claim screening removes salaries, fees, guarantees, visa or admission outcomes and named institutions. |
| Inputs | All 11 profile sections are classified as student-provided, counsellor-entered or missing, and as verified or unverified (from the profile provenance system). The model sees a reliability label for each section. Names, e-mail, phone, exact location and date of birth are never sent. |
| Usage and cost | Records input, cached, output and reasoning tokens, the provider response id (`resp_…`), attempts, latency and the estimated cost (official gpt-6.1-terra rates; uncached input is priced at the cache-write rate as an upper bound). |
| Consent | A checkbox is no longer accepted. A valid row in the new **consent register** is required. The row records who consented, how, an evidence reference and the date, and it can be withdrawn. The `fictional_test_account` method is accepted only for listed development test accounts. |
| Real students | Blocked for OpenAI until **both** `AI_REAL_STUDENT_DATA_APPROVED=true` (application) **and** `ai_usage_settings.real_student_processing_approved = true` (database, set by a super admin with a reference after the privacy review). Gemini stays fictional-only. |
| Pilot budget | All-time ceilings on paid analyses: 5 runs and USD 2.00. The database applies the lower of the app value and its own setting. The live script adds a second, local ledger. |
| Duplicates | A server-generated idempotency key, one analysis in progress per student (enforced in the database), and a submit button that disables itself while pending. |
| Counsellor Studio | New workspace at `/counsellor/students/[id]/ai-career-intelligence` (see below). The Student Case page now shows a compact card that links to it. |

## Counsellor Studio workspace

The layout follows the agreed UX reference, but **every value comes from application data**:

- **Provider bar**: the configured provider and model from server configuration (never the key). It shows Consent, Entitlement, Data policy and Usage chips computed from the consent register, the entitlement check, the data policy and the usage RPC.
- **Left column**: profile readiness (`calculateCompletion`), with source and verification for each section (provenance), and a minimal profile snapshot (no date of birth, gender, location or free text).
- **Centre**: the stored analysis, with tabs for Summary, Recommended careers, Comparison, Education pathways, Action plan, and Gaps & questions. The header shows when it was generated, the tokens and the estimated cost, all from the **ledger row**. "OpenAI — Live GPT" appears only when the ledger records the run as `openai`, and the model shown is the one the API returned. Careers show the deterministic engine's band and evidence level, **never a percentage**. The NW07 draft editor and Submit for review form sit below, unchanged.
- **Right column**: the analysis workflow, derived from the real draft status (draft → submitted → independent approval → released); the gate list and the **Generate** button, which is enabled only when every gate passes; the consent card (record or withdraw); and the AI usage card (limits are the lower of app and database).
- Approval still happens only on the report page, and the database prevents the author from approving their own draft. The student sees the report only after it is approved and released.

## Environment variables (server-side only; never `NEXT_PUBLIC_`)

```
OPENAI_API_KEY=                     # from the OpenAI dashboard: never paste it into chat, never commit it
AI_PROVIDER=openai
AI_OPENAI_MODEL=gpt-6.1-terra
AI_OPENAI_APPROVED=true
AI_OPENAI_REASONING_EFFORT=low      # optional; none|low|medium|high
AI_MAX_OUTPUT_TOKENS=6000           # optional; 6000 is the default for openai and the hard maximum
AI_PAID_MAX_RUNS=5                  # optional; pilot ceilings (database is the lower bound too)
AI_PAID_TOTAL_BUDGET_USD=2
# AI_REAL_STUDENT_DATA_APPROVED     # leave UNSET for the pilot
```

None of these are set automatically.

## Database

- Proposed migration: `supabase/migrations-proposed/NW09_2_openai_live_pilot.sql`. It requires NW07 and NW09 and fails fast without them. It is idempotent, includes a rollback section, and was rehearsed on local PostgreSQL 16 (see the release package).
- Read-only readiness check: `supabase/verification/verify-nw09-database-readiness.sql`. It is safe on both projects and returns PASS / MISSING / FAIL for each object.
- **Activation is blocked while any row is MISSING or FAIL.**

## Live pilot (QA, fictional adult only)

```
.\scripts\nw09\Run-NW09OpenAiLiveTest.ps1               # preflight: no OpenAI call
.\scripts\nw09\Run-NW09OpenAiLiveTest.ps1 -LiveApiTest  # one paid call, typed confirmation
.\scripts\nw09\Verify-NW09Workflow.ps1                  # read-only workflow check
```

The scripts accept only project `ynwzijulzksmrcwdhudv` and refuse `bwlkxunujngksibfzzfv`. They require the seeded fictional QA student, recorded consent and an adult profile. They print the provider, model, status, response id, tokens and estimated cost, and they never print the key.

## Known limitations

- The cost figure is an estimate. The OpenAI dashboard is authoritative, so also set an OpenAI **project budget**.
- A timed-out request may still be billed by OpenAI. It is recorded as failed and is not retried.
- University and course recommendations are still not part of the AI output. Academic direction names fields of study only.
- The database trusts the server's data classification (fictional or real). A direct RPC call cannot send anything to OpenAI, because the key exists only on the server.
