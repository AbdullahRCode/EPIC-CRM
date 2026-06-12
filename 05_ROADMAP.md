# 05 — 10x Roadmap: the "Million-Dollar CRM" for EPIC Menswear
**2026-06-11 · grounded in what the codebase actually has today**

EPIC's edge is *relationship retail*: a man who gets a suit fitted here once should come back for his next wedding, his son's grad, and every Diwali/Eid/Stampede occasion in between. The CRM already captures the raw material (visits, spend, measurements, events, alterations). The roadmap below turns that captured data into repeat revenue, ordered by payback speed.

---

## Tier 1 — Quick Wins (days each, do these first)

### 1.1 Ship the security/deploy checklist *(prerequisite for everything)*
Run the RLS migration, rotate secrets, set `EMAIL_FROM` (see `04_BUGFIXES_AND_BACKLOG.md` §B). **Why:** every feature below is worthless if the client book leaks or saves silently fail. **Effort:** 1 hour. **Impact:** existential.

### 1.2 Duplicate-phone guard + client merge
Warn on create when the phone already exists; owner-only merge tool. **Why:** duplicate records split purchase history, so VIPs look like strangers — staff greet a $3,000 client as a first-timer. **Effort:** 2–3 days. **Impact:** data quality that every other feature depends on.

### 1.3 WhatsApp deep-link notifications
Beside the new "Email — ready for pickup" button, add a `wa.me/<phone>?text=<prefilled>` link and log it to `comms`. No API costs, works from any staff phone. **Why:** EPIC's clientele (South Asian + Chinese communities across Surrey/Burnaby) lives on WhatsApp; pickup notifications cut shelf-clutter and free alteration racks days sooner. **Effort:** 1–2 days. **Impact:** immediate, measurable pickup-time drop.

### 1.4 Follow-up worklist ("Today" queue)
A single intake-page list: inquiries with event dates approaching, alterations promised today, follow-ups flagged, cold VIPs. The data and tags all exist — they're just scattered. **Why:** turns the CRM from a logbook into a *to-do list that sells*. An inquiry for a wedding 6 weeks out, called back at week 3, is the cheapest suit sale you'll ever make. **Effort:** 3–4 days. **Impact:** converts the existing Inquiry/Follow-up tags into revenue.

### 1.5 Surface the Calendar properly + event reminders in the daily report
Calendar is now reachable (fixed in Phase 4); add "events in the next 14 days" to the owner's daily PDF and the intake worklist. **Why:** wedding/grad dates are the single strongest purchase predictor already in the data. **Effort:** 1–2 days.

### 1.6 Nightly data export (backup + ownership)
Cron that emails/stores a CSV of clients + sales. **Why:** six stores' client books are the business's most valuable asset; today one bad import could erase it. **Effort:** 1 day (clone the report cron).

## Tier 2 — Mid-Term (weeks to 3 months)

### 2.1 Occasion-based marketing automation
Segment sends (email now, SMS later via Twilio — cost decision) keyed to what's already stored: event anniversaries ("the wedding suit's first anniversary — time for a refresh"), pre-Diwali/Eid/Lunar New Year/Stampede pushes per branch (cultural calendar already exists in code), birthday capture at intake. Start manual ("export segment → send via Resend broadcast"), automate after two cycles prove it. **Why:** occasion shopping is EPIC's entire category; this is the highest-ROI marketing a menswear chain can run. **Effort:** 2–4 weeks incl. unsubscribe/consent handling (CASL compliance — Canada requires opt-in; capture it at intake). **Impact:** the difference between a logbook and a marketing machine.

### 2.2 Win-back + post-purchase journeys
Automated: 7-day post-purchase "how's the fit?" (drives alteration revenue + reviews), 90-day cold-VIP win-back with a private-appointment offer. The Cold/VIP tags already compute this. **Effort:** 1–2 weeks on top of 2.1's sending rails.

### 2.3 Appointment booking for fittings/alterations
A `appointments` table linked to clients + a simple staff calendar per branch; later a public booking page. **Why:** tailoring slots are EPIC's bottleneck resource; bookings tied to client records mean the fitter sees measurements and history before the client walks in. **Effort:** 3–4 weeks. **Impact:** high — converts inquiries into committed visits.

### 2.4 Loyalty / referral program (lightweight)
Points = dollars spent (already tracked per visit); VIP tiers already derive. Add a redeemable-credit field + redemption log, and a "referred by" field at intake. **Why:** grooms bring groomsmen — weddings are group purchases; referral capture quantifies and rewards that. **Effort:** 2–3 weeks. **Decision needed:** reward economics.

### 2.5 Staff attribution done right
Replace free-typed staff names on visits with the actual user account (dropdown of branch staff). **Why:** enables commission/leaderboards (Insights already tries to chart staff revenue but free-text names fracture it: "Raj", "raj", "Rajdeep"). **Effort:** 1 week + small schema addition.

### 2.6 Ops hardening from the backlog
Optimistic locking (B2), AI cost caps (B4), password reset/MFA/offboarding (B5), audit log (B6), Next 15 upgrade (B1). **Effort:** ~2 weeks total. These keep the growing system trustworthy.

## Tier 3 — Long-Term Vision (3–12 months, the million-dollar version)

### 3.1 POS / payments integration
Today spend is hand-typed and walk-ins go to `anonymous_sales`. Integrate with the actual POS (Square/Lightspeed/Shopify POS — whichever the stores run; **business decision**) so every transaction auto-attaches to a client. **Why:** removes the biggest data-entry burden and makes LTV/repeat-rate numbers *true*. **Effort:** 4–8 weeks. **Impact:** transformational — the CRM becomes the system of record.

### 3.2 Real inventory awareness
Sync product catalog + stock per branch. Special orders check sister-store stock first ("Burnaby has the 42R in navy — transfer takes 2 days"). **Why:** EPIC's six-location footprint is an inventory advantage no mall competitor matches; today the CRM doesn't know what's on the rack. **Effort:** 6–10 weeks, depends on 3.1's platform choice.

### 3.3 Analytics that answer owner questions
True LTV cohorts, repeat-purchase rate, category/season mix, branch benchmarking, alteration turnaround SLAs, campaign attribution (ties to 2.1). Replace the AI-guessed daily summary's inputs with these real metrics — same UI, real numbers. **Effort:** 4–6 weeks once 3.1 lands.

### 3.4 Client-facing touchpoints
"My EPIC profile" — a magic-link page where a client sees his measurements, order status, appointments, and loyalty balance; doubles as the booking entry point and a measurement-update prompt. **Why:** measurement history is EPIC's moat — make the client feel it. **Effort:** 6–8 weeks (needs careful auth — magic links, no passwords).

### 3.5 Multi-tenant productization (optional endgame)
`tenant_id` is already on every table. If the CRM proves itself across 6 EPIC stores, the same codebase can be sold to other independent menswear retailers — that's the literal million-dollar version. **Effort:** 2–3 months (tenant onboarding, billing, isolation tests). **Decision:** is EPIC a retailer or also a software vendor?

---

## Sequencing logic
1. **Now:** Tier 1 (≈2 weeks total) — security live, data clean, notifications + worklist driving daily behavior.
2. **Quarter:** 2.1 → 2.2 → 2.3 (marketing rails, then journeys, then bookings), with 2.5/2.6 woven between.
3. **Decide by month 3:** POS platform (3.1) — it gates 3.2/3.3.
4. **Months 6–12:** client portal (3.4); revisit 3.5 only after EPIC's own numbers prove the story.

Every Tier-2/3 item that needs new spend (Twilio, POS APIs, loyalty rewards) or schema changes is flagged as a business decision — none get built without sign-off.
