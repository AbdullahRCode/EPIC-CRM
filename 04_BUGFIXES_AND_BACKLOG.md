# 04 — Bug Fixes & Backlog
**EPIC Menswear CRM · 2026-06-11**

---

## A. Fixed in this pass (Critical + High)

Each fix is one commit on `main`; `tsc --noEmit` clean and 11 new unit tests pass (`npm test`).

| Finding | Fix | Commit |
|---|---|---|
| (pre-existing work) | Committed the 2026-06-10 security hardening that was sitting uncommitted (lib/auth.ts, app_metadata roles, branch scoping, RPC) | `1bda060` |
| S5 (partial) | `npm audit fix` — patched `ws` memory disclosure | `0fb83da` |
| S2 🔴 | Cron secret removed from `vercel.json`; reports route now accepts Vercel's `Authorization: Bearer CRON_SECRET` header; query-param secret still supported via env only | `26ca…` |
| S1 🔴 (prep) | **`supabase/migrations/0001_security_roles_rls.sql` written — NOT run** (see section C) | same |
| S3 🟠 | `getSupabaseAdmin()` no longer falls back to the anon key; accepts both env var names; admin route reuses it | `…` |
| S4 🟠 + F10 | `send-email`: branch-scoped for employees, `statusType` allowlist, `sent_by` from session; both email routes share `EMAIL_FROM` env | `…` |
| F5/F6 🟠 | New `lib/dates.ts` (America/Vancouver store clock; `NEXT_PUBLIC_BUSINESS_TZ` to override). All date stamps (intake, anon sales, insights, AI summary, reports, modal, Cold tag) converted; date-only strings parsed at noon — fixes "evening entries dated tomorrow" and same-day events vanishing from Upcoming | `2623606` |
| F2 🟠 | AI Note repaired: `/api/ai/search` gained a lightweight `mode:"note"` path returning `{result}` (also stops serializing the full client list for note generation) | `80da357` |
| F4 🟠 | Calendar added to dashboard nav | `80da357` |
| F8 🟡 | Browser/server branch semantics aligned (`""`, never `"All"`, for unassigned employees); intake page shows "No branch assigned" instead of creating invisible branch-`""` records; quick form validates its default branch | `80da357` |
| F7 🟡 | Photo import: 4 MB pre-check with a clear message, per-row failure collection, failed rows kept on screen for retry, extraction errors surfaced (was: silent partial imports) | `7d1ad39` |
| S6 🟡 | Server-side validation in client actions: updatable-column allowlist (kills mass assignment of `id`/`tenant_id`/`created_at`), branch/phone/email/date format checks, spend bounds, 5 000-char note caps | `7d1ad39` |
| F3 🟠 | "✉ Email client — ready for pickup" button in ClientModal when alteration status = Ready (first real writer to the `comms` log; Comms page now has a purpose) | `7d1ad39` |
| S1 (prep) | Comms page reads via an owner/admin **server action** instead of a browser anon-key query — keeps working after RLS | `7d1ad39` |
| S14 ⚪ | Settings password input masked + `autocomplete="new-password"`; server enforces ≥ 8 chars | `7d1ad39` |

**Tests added** (`tests/`): store-clock date stamping (incl. the evening-rollover regression), noon parsing, `daysAgoStr`, and `deriveTags` boundaries (VIP at exactly $1 000, Returning at 2 visits, Cold at 90 days, Alterations clearing on Picked up, Inquiry tag). Run with `npm test`.

## B. Deployment checklist (you must do these — I can't from here)

1. **Run `supabase/migrations/0001_security_roles_rls.sql`** in the Supabase SQL editor *(review emails/branches in section 1 of the script first)*. This is the pending migration the app already depends on **plus RLS** — without it, everyone is an employee and anonymous sales fail. ⚠️ Requires your explicit go-ahead since it changes DB security posture; nothing destructive, no data deleted.
2. In Vercel env vars: ensure **`SUPABASE_SERVICE_ROLE_KEY`** is set (the code now refuses to run admin writes without it), set **`CRON_SECRET`** (Vercel signs cron calls with it automatically), **rotate `REPORT_SECRET`** (the old `epic-report-2026` value is burned — it's in git history), and set **`EMAIL_FROM`** to your Resend-verified sender.
3. After the migration, **all staff must sign out and back in** (JWTs cache `app_metadata`).
4. Have everyone smoke-test: owner login → dashboard; employee login → intake; log a sale; create a client; mark Ready → send email; check Comms page.

## C. Backlog — Medium/Low (logged, not implemented)

| # | Sev | Item | Suggested fix | Effort |
|---|---|---|---|---|
| B1 | 🟠* | Next.js 14.2.35 high CVEs (no in-range patch; fix = Next 15/16) | Upgrade to Next 15 (App Router codemod is mild); needs a regression pass | M |
| B2 | 🟡 | Concurrent edits last-write-wins on `visits` JSONB (F9) | Add `version` column + optimistic check, or split visits into their own table (schema change — needs approval) | M–L |
| B3 | 🟡 | No duplicate detection (same person × N records) | On create, warn if a client with the same normalized phone exists in-branch; add merge tool for owner | M |
| B4 | 🟡 | No rate limiting / AI cost caps (S8) | Per-user daily counters (Postgres table or Upstash); UI debounce | S–M |
| B5 | 🟡 | No password reset / staff offboarding / MFA (S9) | Admin reset + disable endpoints (Supabase admin API), TOTP MFA for owner/admin | M |
| B6 | 🟡 | No audit log (S10) | `audit_log` table written from server actions; surface in Settings | M |
| B7 | 🟡 | No backups beyond Supabase defaults (S11) | Nightly CSV/`pg_dump` export cron to private storage; document restore | S–M |
| B8 | 🟡 | Prompt-injection hardening (S7) | Confirm-before-apply for AI actions; validate AI-returned IDs/status enums server-side | S–M |
| B9 | ⚪ | Dead code: `AISearchPanel`, `CompetitorIntel` + `/api/competitor`, `TrendChart`, `MultiSelect`, `lib/openai.ts` + `openai` dep, `/api/ai/clean-note`, `searchClients` action, `EPIC_CRM_PROMPT_R4B.md` | Delete (or re-mount CompetitorIntel/AISearchPanel if wanted — product call) | S |
| B10 | ⚪ | README drift (voice command, WhatsApp/SMS buttons, etc.) | Rewrite Features section to match reality | S |
| B11 | ⚪ | `intake` quick form: no inline phone format hint; spend `0` stored as undefined | Cosmetic polish alongside B3 | S |
| B12 | ⚪ | Settings staff list caps at 50 (Supabase listUsers page size) | Paginate when >50 staff | S |
| B13 | ⚪ | WhatsApp/SMS notification channels (README promise) | `wa.me` deep links are free; SMS needs Twilio (cost — business decision) | M |

\* B1 is High severity but Large effort with breaking-change risk — held back per the "flag breaking changes" rule rather than fixed blind.

## D. Not done on purpose
- **No schema/data changes executed** — the RLS migration is written but waits for your approval (working rule #4).
- **No dead-code deletion** — listed in B9; deleting files is a product decision (CompetitorIntel might be wanted back).
- **No Next 15 upgrade** — breaking-change risk; needs a dedicated pass with manual smoke testing.
- **Nothing pushed to the remote** — all 8 commits are local; push when you're ready.
