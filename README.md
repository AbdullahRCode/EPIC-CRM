# EPIC Menswear CRM

A multi-tenant client management system for EPIC Menswear — luxury menswear across 6 BC/Calgary locations.

## Stack

- **Next.js 14** — App Router, Server Actions
- **TypeScript** — strict mode
- **Tailwind CSS** — custom design tokens (editorial luxury aesthetic)
- **Supabase** — database + auth
- **Anthropic Claude** — AI search, note cleaning, daily summary, voice interpretation, photo extraction
- **OpenAI Whisper** — voice transcription
- **Perplexity** — cultural event date refresh
- **Resend** — transactional email for client notifications
- **Vercel** — deploy target

## Environment Variables

Create `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
RESEND_API_KEY=re_...
```

## Supabase Setup

Create these two tables in your Supabase project:

### `clients`

```sql
create table clients (
  id text primary key,
  tenant_id text not null default 'epic-menswear',
  name text not null,
  phone text not null,
  email text,
  branch text not null,
  events jsonb default '[]',
  event_date date,
  event_note text,
  alterations jsonb default '[]',
  alteration_note text,
  alteration_status text,
  special_order text,
  special_order_status text,
  follow_up jsonb default '{"needed": false}',
  measurements jsonb default '{}',
  visits jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on clients (tenant_id);
create index on clients (branch);
create index on clients (updated_at desc);
```

### `comms`

```sql
create table comms (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'epic-menswear',
  client_id text references clients(id) on delete cascade,
  channel text not null,
  direction text not null,
  summary text,
  sent_by text,
  created_at timestamptz default now()
);

create index on comms (tenant_id);
create index on comms (client_id);
```

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Add all environment variables in Vercel project settings
4. Deploy

## Features

| Tab | Description |
|-----|-------------|
| **Logbook** | Client list with AI search, text/tag/date filters, client modal with full CRUD |
| **Insights** | Branch comparison bars, 6-month trend chart (pure SVG), AI daily summary |
| **Calendar** | Upcoming client events + cultural calendar (Diwali, Lunar New Year, Stampede, etc.) with weekly Perplexity refresh |
| **Comms** | Owner-only log of all inbound/outbound messages |

### AI Features
- **AI Search** — natural language queries with 7 suggestion chips
- **Note Cleaner** — manual button on visit notes, auto-clean on alteration save
- **Daily Summary** — structured briefing with action items, branch breakdown, tomorrow outlook, weekly target
- **Voice Command** — record → Whisper transcription → Claude interpretation → confirm → apply (20-step undo)
- **Photo Intake** — upload handwritten logbook page → Claude vision extracts entries → bulk import

### Auto-derived Tags
`VIP` (≥$1000 lifetime) · `Returning` (2+ visits) · `Cold` (90d+ since visit) · `Events` · `Alterations` · `Special Order` · `Follow-up`

### Status Pipelines
- Alterations: Received → In progress → Ready → Picked up
- Special Orders: Received → Ordered → Arrived → Picked up

When status hits **Ready** or **Arrived**, inline WhatsApp / SMS / Email notification buttons appear in the client modal.
