# 02 — Security Findings
**EPIC Menswear CRM · Reviewed 2026-06-11**
Severity: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low

---

## Summary table

| # | Severity | Area | Finding |
|---|---|---|---|
| S1 | 🔴 Critical | Data protection | No RLS on Supabase tables — public anon key grants full DB read/write to anyone |
| S2 | 🔴 Critical | API security | Cron secret `epic-report-2026` committed in `vercel.json` |
| S3 | 🟠 High | Infra config | `getSupabaseAdmin()` silently falls back to anon key; service-role env var has two different names |
| S4 | 🟠 High | Authorization | `/api/comms/send-email` lets any authenticated employee email any client in any branch (no role/branch check, no rate limit) |
| S5 | 🟠 High | Dependencies | Next.js 14.2.35 chain: 4 high CVEs (XSS, DoS, SSRF, cache poisoning) |
| S6 | 🟡 Medium | Input validation | No server-side validation of client payloads (phone/email/branch/dates accepted as-is; `updateClient` accepts arbitrary `Partial<Client>` columns) |
| S7 | 🟡 Medium | AI security | Prompt injection into AI search can trigger status-change "actions"; full client list serialized into every prompt |
| S8 | 🟡 Medium | API security | No rate limiting on AI routes (each call = paid Claude tokens); competitor route's in-memory limiter resets per serverless instance |
| S9 | 🟡 Medium | Auth lifecycle | No password reset flow, no MFA, no way to deactivate/remove staff, admin sets plaintext "temporary" passwords with no complexity/expiry |
| S10 | 🟡 Medium | Logging & monitoring | No audit trail (who edited/deleted a client), no security event logging, no alerting; `console.error` only |
| S11 | 🟡 Medium | Backups | No automated backup/restore beyond Supabase plan defaults; no export tooling |
| S12 | ⚪ Low | CSRF | Cookie-authed JSON POST routes rely solely on SameSite=Lax (acceptable, but no origin check on API routes) |
| S13 | ⚪ Low | Data protection | Full-client-list PDF emailed daily; PII lives in third-party AI/email providers' logs (Anthropic, Perplexity, Resend) |
| S14 | ⚪ Low | Settings UX | Password field is `type="text"` (visible on screen in-store) |

---

## S1 🔴 No Row-Level Security — entire database exposed via the public anon key
**Evidence:** README's `CREATE TABLE` statements never `ENABLE ROW LEVEL SECURITY`; no SQL/migration files exist; `app/(dashboard)/comms/page.tsx` reads `comms` *from the browser* with the anon key and `app/actions/anonymous.ts` reads/writes `anonymous_sales` with the anon-key server client — both only work if RLS is off.
**Impact:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is shipped to every visitor's browser. With it, anyone (no login) can `GET https://<project>.supabase.co/rest/v1/clients?select=*` and read — or rewrite — every customer's name, phone, email, measurements and purchase history. All app-level role checks are bypassed because the data layer itself is open.
**Remediation (SQL on Supabase — needs your go-ahead, see Phase 4):**
1. `ALTER TABLE clients ENABLE ROW LEVEL SECURITY;` (same for `comms`, `anonymous_sales`).
2. Add policies: deny-all for `anon`; authenticated users read/write rows matching their `app_metadata` role/branch (or simply *no* policies, forcing all access through the service-role server actions — the cleanest fit for this app's architecture).
3. Move the Comms page read into a server action using `requireRole("owner","admin")`.
4. Keep `anonymous_sales` RPC working by marking `add_anonymous_sale` as `SECURITY DEFINER` or routing it through the admin client.

## S2 🔴 Cron secret committed to git (`vercel.json`)
`"path": "/api/reports/daily?secret=epic-report-2026"` is in the repo (and in git history). If `REPORT_SECRET=epic-report-2026` in Vercel, anyone with repo access can trigger client-data PDF emails, and the secret also leaks in request logs/URLs.
**Remediation:** Rotate `REPORT_SECRET`; have the cron send the secret via a header (Vercel cron jobs send `authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` env is set — use that instead); strip the query param from `vercel.json`. Optionally rewrite git history, or treat the old value as burned.

## S3 🟠 Service-role fallback + env naming drift
`lib/supabase.ts:25` — `SUPABASE_SERVICE_ROLE_KEY ?? NEXT_PUBLIC_SUPABASE_ANON_KEY`: if the var is missing, "admin" writes silently run as anon (works today only because of S1; the moment RLS is enabled, every save breaks *quietly*). Meanwhile `app/api/admin/employees/route.ts` expects `SUPABASE_SERVICE_ROLE_KEY_EPIC`.
**Remediation:** One canonical `SUPABASE_SERVICE_ROLE_KEY`, no fallback — throw on missing. Update the admin route to use `lib/supabase.ts`'s `getSupabaseAdmin()`.

## S4 🟠 `send-email` route: no role/branch scoping
Any signed-in user (employee of any branch) can POST `{clientId, statusType, sentBy}` for **any** client in **any** branch; `sentBy` is caller-controlled (spoofable audit trail); no rate limit on Claude + Resend usage. Middleware skips `/api/*`, so the intake-only restriction doesn't apply.
**Remediation:** Use `requireSession()`, scope employees to their branch (same pattern as `getClients`), derive `sent_by` from the session profile, and validate `statusType` against an allowlist.

## S5 🟠 Vulnerable framework chain
See Phase 1 §4. Next 14.2.35 (4 high), nested postcss (moderate), `ws` (moderate).
**Remediation:** `npm audit fix` for `ws` now; bump Next to the latest patched release (planned in Phase 4 — non-breaking within 14.2.x if available, else flag the 15.x upgrade as a business decision).

## S6 🟡 No server-side input validation
- `createClient`/`updateClient` accept any strings: phone/email never validated, `branch` not checked against `BRANCHES` (admin/owner path), dates unvalidated, no length caps on notes (10 MB action body limit = giant JSONB rows possible).
- `updateClient(id, updates)` spreads caller-supplied `Partial<Client>` straight into `.update()` — a crafted request can set `tenant_id`, `created_at`, or `id` itself (mass-assignment).
- No duplicate-phone detection (Phase 3 confirms duplicate records are easy).
**Remediation:** Shared validator (zod or hand-rolled) in server actions: allowlist updatable columns, validate enums/dates/email/phone formats, cap note lengths.

## S7 🟡 Prompt injection in AI routes
`/api/ai/search` interpolates the raw user query into a prompt that can return **actions** (`mark_alteration`, `mark_order`) which the client then executes; a crafted "search" (or client name stored earlier) can flip statuses or skew results. Owner-mode searches embed the *entire* client list in the prompt.
**Remediation:** Treat AI output as untrusted: confirm actions in UI before applying (intake-style confirm dialog), validate returned IDs/status values server-side, and consider tool-use/structured outputs instead of regex-matched JSON.

## S8 🟡 No rate limiting / cost controls on AI endpoints
`search`, `summary`, `photo-extract`, `clean-note` can be hammered by any authenticated user → unbounded Anthropic spend. The competitor route's module-scope counter doesn't survive serverless cold starts.
**Remediation:** Per-user daily caps in Postgres/Upstash; debounce in UI; alert on spend.

## S9 🟡 Auth lifecycle gaps
No self-serve password reset (login page says "contact your manager" but there is no admin reset endpoint), no MFA for owner/admin accounts (which see all PII), no staff offboarding (no delete/disable in Settings — departed employees keep working credentials), no password policy on creation.
**Remediation:** Add admin endpoints for password reset + user disable/delete; enable Supabase MFA (TOTP) for owner/admin; minimum password length check in the employees POST route.

## S10 🟡 No audit logging or monitoring
Client deletes are silent and irreversible; edits aren't attributed (the `staff` field is free-typed text); no log of sign-ins, role changes, failed auth, or AI usage; no error tracking (Sentry/Logflare).
**Remediation:** `audit_log` table written from server actions (actor user id, action, entity, before/after), plus Vercel log drains or Sentry.

## S11 🟡 Backups & disaster recovery
Nothing in-repo; Supabase free/pro defaults only (daily snapshot at best, limited retention). One bad bulk import or a malicious anon-key write (S1) is unrecoverable.
**Remediation:** Verify plan-level PITR; add a nightly `pg_dump`/CSV export cron (can reuse the existing report cron pattern) to private storage; document a restore procedure.

## S12–S14 ⚪ Low
- **CSRF:** Server Actions carry Next's built-in origin checks; the JSON API routes rely on SameSite=Lax cookies — fine for modern browsers; add an origin check if you ever loosen cookie settings.
- **Third-party PII flow:** client names/phones/purchases go to Anthropic (search/summary/photo), Resend (emails), in plaintext PDFs over email. Acceptable for the business, but document it in a privacy note; trim prompts to fields actually needed.
- **Settings password input** is visible text; switch to `type="password"` with a reveal toggle.

## What's already done well ✓
- JWT verified server-side via `getUser()` (not the spoofable `getSession()`); roles in `app_metadata` (service-role-writable only).
- Every API route checks the session; reports route requires owner/admin or secret with no hardcoded fallback.
- Branch scoping for employees enforced **inside queries**, not just in UI; employees can't move clients between branches.
- React's default escaping everywhere; no `dangerouslySetInnerHTML`; supabase-js parameterizes queries (no raw SQL).
- HTTPS/TLS end-to-end (Vercel + Supabase); secrets out of git history (`.env*.local` ignored) — with the single S2 exception.
