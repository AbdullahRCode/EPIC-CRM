# 03 — Intake & Functional Test Results
**EPIC Menswear CRM · 2026-06-11**

> **Method note:** `.env.local` contains no Supabase/Anthropic/Resend keys, so the app cannot be run against the real database from this machine. Findings below come from a complete static trace of every intake path (all code read end-to-end), TypeScript compilation (passes clean), and edge-case analysis. Items marked **[needs live verify]** should be confirmed once the app runs with real keys.

---

## 1. Intake point inventory

| # | Intake point | Who | Path |
|---|---|---|---|
| I1 | Quick-entry form (new client) | All staff | `ClientModal` → `createClient` server action → `clients` insert |
| I2 | Client edit (accordion) + "Log visit" | All staff | `ClientModal` → `updateClient` → full-row update |
| I3 | "Alteration Ready" one-tap button | Employees (intake page) | confirm dialog → `updateClient` |
| I4 | Photo intake (handwritten logbook) | All staff | upload → `/api/ai/photo-extract` (Claude vision) → editable rows → loop of `createClient` |
| I5 | Anonymous sale | All staff | overlay form → `addAnonymousSale` → `add_anonymous_sale` Postgres RPC |
| I6 | Staff creation | Admin only | Settings → POST `/api/admin/employees` → Supabase Auth admin API |
| I7 | AI search "actions" | (orphaned UI) | `/api/ai/search` returns `mark_alteration`/`mark_order` — panel that executed them is no longer mounted |
| I8 | Notification email | (orphaned) | `/api/comms/send-email` — **no UI calls it** |
| I9 | Report cron | Vercel cron / owner button | GET `/api/reports/daily` → PDF → Resend |
| I10 | Cultural event refresh | (unreachable page) | Calendar page → Perplexity → Claude parse |

There are **no** CSV/Excel imports, no inbound webhooks (Shopify/POS), and no public-facing forms — all intake is authenticated staff entry.

## 2. Broken or silently-failing flows

### F1 🔴 BLOCKER (deploy state): pending Supabase migration breaks login routing and anonymous sales
The 2026-06-10 hardening reads roles from `app_metadata` and calls the `add_anonymous_sale` RPC, but the companion SQL (role migration + unique constraint + RPC function) has not been run yet.
**Until it runs:** every user — including the owner/admin — defaults to role `employee` with no branch → redirected to `/intake` with an **empty client list**; "Save Sale" fails with a toast (`add_anonymous_sale does not exist` underneath). **Repro:** sign in as any user before the migration; observe redirect to `/intake` and empty logbook. **Fix:** run the migration (Phase 4 ships the SQL file), then have all users sign out/in to refresh JWTs.

### F2 🔴 AI Note always renders empty (ClientModal)
**Repro:** open any client → "✦ AI Note" → Generate → spinner ends, nothing appears.
**Root cause:** `ClientModal.tsx:920` POSTs the note prompt to `/api/ai/search` with `mode:"note"`, but the route ignores `mode`, treats the prompt as a *client search*, and returns `{type, ids, interpretation}`. The component reads `data.result ?? data.summary ?? data.text` — all undefined. Each click also burns a full Claude call (entire client list serialized into the prompt).

### F3 🟠 Comms page can never show data
Nothing writes to the `comms` table: the only writer is `/api/comms/send-email`, and no component calls it (the README's WhatsApp/SMS/Email buttons on Ready/Arrived were never built or were removed). **Repro:** mark any alteration Ready → no notification UI appears anywhere; Comms tab shows "No communications logged yet" forever.

### F4 🟠 Calendar page unreachable
`app/(dashboard)/calendar/page.tsx` renders fine but no nav entry links to it (`NAV` in the dashboard layout lists Logbook/Insights/Comms/Settings only). Client event dates and the cultural calendar are invisible to users — wedding/event follow-ups silently rot.

### F5 🟠 Timezone bug: evening entries get tomorrow's date
All "today" stamps use `new Date().toISOString().split("T")[0]` (UTC). BC/Calgary are UTC-7/8, so **any visit, anonymous sale, or quick entry logged after 4/5 pm local is dated the next day**. Today-counts on the intake header, the dashboard "today" anonymous-sales lookup, and daily report numbers are all shifted for evening trade — peak retail hours. **Repro:** log a sale at 6 pm PDT; it lands on tomorrow's `sale_date`; "Today" stat stays 0.

### F6 🟡 Upcoming-events list drops same-day events (off-by-one)
`ClientList.tsx:163` parses `event_date` with `new Date("YYYY-MM-DD")` (UTC midnight = previous evening local). The `eventDate >= now(local midnight)` filter then excludes events happening **today**, and date displays can show the previous day. The intake page already uses the `+ "T12:00:00"` fix; ClientList doesn't.

### F7 🟡 Photo import: silent partial failure + duplicates
- `handleImport` loops `createClient` per row with **no catch**: if row 3 of 8 fails, rows 1–2 are saved, the rest are lost, no error is shown, and the overlay stays open looking idle.
- Importing the same photo twice creates **full duplicates** (new UUID each time; no phone-based dedupe anywhere in the system).
- Phones may import as `""` → records that can't be found by phone search.
- **[needs live verify]** Phone photos commonly exceed Vercel's ~4.5 MB request limit → 413 before the route runs, surfaced only as a console error ("Photo processing failed" path never reached; overlay just stops).

### F8 🟡 Employee with no branch assigned creates invalid rows
Browser profile (`lib/user-role.ts`) defaults branch to `"All"` while the server (`lib/auth.ts`) defaults to `""`. An employee created without a branch gets `defaultBranch="All"` in the quick form; on save the server overwrites branch with `""` → a client row with branch `""` that **no branch view can see** (only the owner's "All" view). Same drift means the intake page shows that employee an empty list while the modal claims a branch exists.

### F9 🟡 Concurrent edits lose data (last-write-wins on whole JSONB arrays)
`updateClient` writes the full `visits` array. Two staff editing the same client (front desk adds a visit while the tailor flips alteration status via the intake quick-button) → whichever saves last silently erases the other's change. No optimistic-lock/version check. Likely in practice: the intake "Alteration Ready" button sends the **entire stale client row**, not just the status field.

### F10 🟡 Two different sender domains for email
`send-email` uses `noreply@epicmenswear.com`; reports use `reports@epicmenswear.ca`. At most one is a Resend-verified domain — the other will be rejected. **[needs live verify]** which one is configured; unify.

### F11 ⚪ Minor edge cases
- `searchClients()` server action is exported but unused (orphaned with AISearchPanel).
- Quick form accepts any string in phone (`"abc"` saves); email field unvalidated (`"x"` saves) — confirmation emails would just fail later.
- `deriveTags` `Cold` uses UTC date parse → tag can flip a day early/late.
- Spend of `0` typed in the visit form is stored as `undefined` (falsy check) — harmless but inconsistent.
- Insights "Export Report" is `window.print()` — fine, but mislabeled as export.
- Settings list shows max 50 users (Supabase `listUsers` default page) — fine at current scale.

## 3. Edge-case matrix (per intake point)

| Case | I1 Quick form | I2 Edit | I4 Photo | I5 Anon sale | I6 Staff |
|---|---|---|---|---|---|
| Empty required fields | ✓ blocked client-side (name/phone); **no server check** | ✓ same | ⚠️ name-only rows importable with empty phone | ✓ blocked (item+amount) | ✓ blocked client-side |
| Duplicates | ❌ no dedupe — same person × N entries | n/a | ❌ same photo twice = full dupes | ✓ by design (RPC accumulates per branch/day) | ✓ Supabase rejects dup email |
| Special chars / unicode | ✓ JSONB + React escaping safe; ⚠️ names flow into AI prompts (injection vector, see Phase 2 S7) | ✓ | ✓ | ✓ | ✓ |
| Large input | ⚠️ no length caps (10 MB action limit) | ⚠️ same | ⚠️ >4.5 MB upload likely 413s | ✓ | ✓ |
| Concurrent submits | ⚠️ double-click can create twice (button disables on `saving` ✓ but network retry can dupe) | ❌ last-write-wins (F9) | ⚠️ partial import (F7) | ✓ atomic RPC (post-migration) | ✓ |
| Malformed data | ⚠️ NaN spend possible via e-notation; invalid dates pass | ⚠️ same | ⚠️ Claude-suggested dates unvalidated | ✓ amounts parsed | ✓ role allowlisted ✓ |
| Offline/error feedback | ✓ error shown | ✓ | ❌ silent (F7) | ✓ toast | ✓ |

## 4. What works correctly ✓
- Quick form → insert → list refresh: clean, including alteration sub-flow and inquiry sub-form.
- Branch scoping on every read/write for employees (server-side).
- Anonymous sales accumulation is genuinely concurrency-safe **once the RPC exists** (atomic `INSERT … ON CONFLICT`).
- Intake "Alteration Ready" confirm-then-update flow with toasts.
- Tag derivation (VIP/Returning/Cold/etc.) consistent between list views.
- Photo-extract prompt is well-designed (uncertain-flagging → auto follow-up task on import).
- Daily/weekly PDF report generation + owner email button (session-authed path).
