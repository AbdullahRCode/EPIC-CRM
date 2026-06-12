# 01 — System & Architecture Audit
**EPIC Menswear CRM · Audited 2026-06-11**

---

## 1. Stack Map

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript (strict) | Single codebase |
| Framework | Next.js **14.2.35** (App Router) | Server Actions enabled, 10 MB body limit |
| UI | React 18 + Tailwind CSS 3.4 + heavy inline styles | Custom "editorial luxury" design tokens in `globals.css` |
| Database | **Supabase** (Postgres) | Tables: `clients`, `comms`, `anonymous_sales`. No ORM — raw `supabase-js` queries. Schema lives only in README + a pending SQL migration (no migration files in repo) |
| Auth | Supabase Auth (`@supabase/ssr`) | Email/password; roles in `app_metadata` |
| AI | Anthropic Claude (`claude-sonnet-4-6`) | Search, note cleaning, daily summary, photo OCR, email drafting |
| Search intel | Perplexity API (`sonar`) | Competitor intel, cultural-event date refresh |
| Email | Resend | Client notifications + owner PDF reports |
| PDF | `@react-pdf/renderer` | Daily/weekly owner report |
| Hosting | Vercel | 2 cron jobs (daily 22:00 UTC, weekly Fri 08:00 UTC) |
| Tests | **None** | No test framework, no test files |
| OpenAI | `openai` package installed | **Unused** — Whisper voice feature in README was never built |

**POS / e-commerce / payments / SMS integrations: none.** Spend is hand-typed; there is no payment processing, no Shopify/POS sync, no SMS provider.

## 2. Data Flow (plain language)

1. **Who can do what:** `middleware.ts` validates the Supabase JWT on every page request. Role comes from `app_metadata` (only service-role writable). `employee` → forced to `/intake` (own branch only); `owner`/`admin` → dashboard; `admin` additionally gets `/settings` (staff management).
2. **Intake:** Staff create/edit clients through `ClientModal` (quick form or accordion edit), bulk-import via `PhotoIntake` (photo → Claude vision → editable rows → import loop), or log walk-in `anonymous_sales` (no client record, atomic RPC upsert per branch/day).
3. **Storage:** Server Actions (`app/actions/*.ts`) run `requireSession()` / `requireRole()` from `lib/auth.ts`, then write via the **service-role** Supabase client (`getSupabaseAdmin`), scoping employees to their branch inside the query. One JSONB-heavy `clients` row holds visits, measurements, events, alterations.
4. **Outputs:**
   - **Logbook/Intake lists** — server action reads, client-side filtering, derived tags (`VIP`, `Cold`, …) computed in `lib/types.ts`.
   - **Insights** — branch bars, donut, AI daily summary (`/api/ai/summary` aggregates → Claude → JSON).
   - **Email** — `/api/comms/send-email` (Claude-drafted, Resend-sent, logged to `comms`), `/api/reports/daily` (PDF report to owner, also hit by Vercel cron with a `?secret=`).
   - **Comms page** — reads `comms` table **directly from the browser** with the anon key.
   - **Calendar** — client events + cultural dates (Perplexity refresh) — *page exists but has no nav link*.

## 3. Environment Variables & Secrets

| Variable | Where used | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all Supabase clients | Public by design — safe **only if RLS is enabled** (see Phase 2) |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase.ts` | ⚠️ **Silently falls back to the anon key** if unset |
| `SUPABASE_SERVICE_ROLE_KEY_EPIC` | `app/api/admin/employees/route.ts` | ⚠️ **Different name** for the same secret — naming drift, easy to misconfigure |
| `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `OPENAI_API_KEY` | lib clients | Server-side only ✓ (`OPENAI_API_KEY` unused) |
| `PERPLEXITY_API_KEY` (+ `_EPIC` fallback in competitor route) | perplexity, competitor | Naming drift again |
| `REPORT_SECRET` | reports cron auth | Set in `.env.local` ✓ |
| `OWNER_EMAIL` | reports recipient | Defaults to a hardcoded address if unset |

**Findings:**
- 🔴 **`vercel.json` hardcodes the cron secret** (`?secret=epic-report-2026`) **and it is committed to git.** If the deployed `REPORT_SECRET` matches it, anyone reading the repo can email the full-client-list PDF to the owner address at will. → Rotate + move to a Vercel cron header/env.
- ✅ `.env.local` is gitignored and never appears in git history.
- ⚠️ Local `.env.local` only contains `PERPLEXITY_API_KEY`, `OWNER_EMAIL`, `REPORT_SECRET` — **local dev is missing Supabase/Anthropic/Resend keys** (app cannot run locally as-is; presumably keys live only in Vercel).
- ✅ No secrets in client-side code (`NEXT_PUBLIC_*` are the only browser-exposed values).

## 4. Dependency Audit (`npm audit`, 2026-06-11)

**7 vulnerabilities: 4 high, 3 moderate** — all in the framework chain, none in app code.

| Package | Severity | Issues | Fix |
|---|---|---|---|
| `next` 14.2.35 | High (×4) | XSS in `beforeInteractive` scripts, image-optimizer DoS, SSRF via WebSocket upgrade, RSC cache poisoning, i18n middleware bypass (Pages-Router-only — N/A here) | Patched in later Next 14.2.x/15.x; `npm audit fix --force` proposes Next 16 (breaking). Recommend pinning latest 14.2.x or planned 15 upgrade |
| `postcss` <8.5.10 (nested in next) | Moderate | XSS via unescaped `</style>` | Comes with Next upgrade |
| `ws` 8.0.0–8.20.0 | Moderate | Uninitialized memory disclosure | `npm audit fix` (non-breaking) |

## 5. Dead Code & Abandoned Surfaces

| Item | Status |
|---|---|
| `components/AISearchPanel.tsx` | **Never imported** — AI search UI was removed (commit d69bb08) but file + suggestion chips remain |
| `components/CompetitorIntel.tsx` + `/api/competitor` | **Component never imported**; the 257-line Perplexity route is unreachable from the UI |
| `components/TrendChart.tsx`, `components/MultiSelect.tsx` | Never imported |
| `lib/openai.ts` + `openai` dependency | Never used — voice/Whisper feature in README does not exist |
| `app/(dashboard)/calendar/page.tsx` + `CulturalCalendar` + `lib/cultural-seeds.ts` + `lib/perplexity.ts` + `app/actions/cultural.ts` | Page works but **has no nav link** — unreachable except by typing the URL |
| `/api/ai/clean-note` | Route is live but **no UI calls it** (clean-with-AI removed in commit f023da6) |
| `/api/comms/send-email` | Route is live but **no UI calls it** — the README's "WhatsApp / SMS / Email buttons on Ready/Arrived" do not exist. Nothing ever writes to `comms`, so the Comms page is permanently empty |
| `ClientModal` "AI Note" | Calls `/api/ai/search` with `mode:"note"`, but the route ignores `mode` and returns `{ids, interpretation}`; the component reads `data.result/summary/text` → **always renders nothing** (broken feature, details in Phase 3) |
| `EPIC_CRM_PROMPT_R4B.md` | Original build prompt left in repo root |
| README | Describes several features that don't exist (voice command w/ 20-step undo, notification buttons, AI search chips, special-order pipeline UI) — **docs drift** |
| `special_order` fields | In DB + types + tags, but the edit form no longer exposes them (removed commit 5c19b8a) — orphaned mid-removal |
| Uncommitted work | 15 modified files + new `lib/auth.ts` (2026-06-10 security hardening) sit **uncommitted** in the working tree; the matching Supabase SQL migration (role `app_metadata`, `anonymous_sales` unique constraint + RPC) is still pending per project notes |

## 6. Repo / Build Health

- Git repo ✓ (remote: AbdullahRCode/EPIC-CRM). Working tree dirty (see above).
- No CI, no lint in CI, no tests, no migration files, no backup tooling.
- TypeScript strict mode on; type-check results in Phase 3/4.
