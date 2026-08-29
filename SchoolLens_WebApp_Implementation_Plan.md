# SchoolLens — Web App Implementation Plan
### Building in Cursor with Claude · Supabase + Vercel + Claude API

---

## 1. Recommended Architecture

Given you already know Supabase and Vercel, don't introduce a separate Python backend — collapse everything into one Next.js repo. This is the standard 2026 pattern for exactly this kind of build (confirmed against current practice, not just familiarity): Next.js on Vercel for frontend + serverless functions, Supabase for Postgres + Auth + Row Level Security, and the Claude API called directly from serverless routes for extraction and Q&A. One repo, one deploy pipeline, no token-refresh or auth-guard code to write by hand — Supabase's Row Level Security handles authorization at the database layer instead.

```
┌─────────────────────────────────────────────┐
│  Next.js 16 (App Router) — Vercel            │
│  ├── Server Components → read claims/scores  │
│  ├── API routes → /api/extract, /api/ask     │
│  └── Client components → search, badges, UI  │
└───────────────┬───────────────────────────────┘
                │
    ┌───────────┴────────────┐
    ▼                         ▼
┌─────────────┐      ┌──────────────────┐
│  Supabase    │      │  Claude API       │
│  Postgres    │      │  (Anthropic SDK   │
│  + Auth      │      │  or Vercel AI SDK)│
│  + RLS       │      │  extraction + Q&A │
└─────────────┘      └──────────────────┘
```

**Why this over the Python/FastAPI plan from earlier:** the schema, RLS, and confidence-engine logic you already tested in SQLite/Python port cleanly to Supabase Postgres and TypeScript — you're not throwing away work, just moving it into one deployable stack instead of two. For your project's scale (5–8 schools, low write volume, a two-week deadline), this stack has no real downside — the scaling caveats you'll read about Vercel+Supabase only bite at production scale, not a competition demo.

**Confidence engine placement:** keep it as **pure TypeScript logic**, not a database trigger or stored procedure. Compute it on-demand when a school page is rendered (a Server Component queries claims, runs the scoring function, renders the result). At your scale this is instant — no caching layer needed, and it keeps the scoring logic auditable and easy to unit-test, matching your "transparent, not a black box" principle.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, TypeScript) | Current stable; Server Components let you query Supabase directly without a separate API layer for reads |
| Hosting | **Vercel** | You know it; zero-config Next.js deploys, preview URLs per branch/PR — useful for iterating fast before the pitch |
| Database + Auth | **Supabase** (Postgres, Auth, Row Level Security) | You know it; RLS replaces hand-written auth-guard code entirely |
| Styling | **Tailwind CSS v4** | Current industry default, fast to build consistent spacing/color systems |
| Components | **shadcn/ui** | Not a component *library* you install — you copy accessible, unstyled Radix-based components into your repo and restyle them. This is the current standard for "looks custom, not templated" without building from scratch |
| Icons | **lucide-react** | Matches shadcn's default icon set |
| AI | **Claude API via Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) | Streaming responses out of the box, works cleanly with React Server Components and the `useChat` hook for your Q&A demo |
| Validation | **Zod** | Validate LLM extraction output before it touches your database — critical given your "never trust unverified data" principle |
| Deployment | **Vercel (frontend) + Supabase (backend)**, connected via the official Vercel–Supabase integration | Auto-syncs environment variables between the two, one less manual step |

---

## 3. Data Model → Supabase Postgres

Port your existing `schema.sql` almost directly — Postgres is a superset of what SQLite needed. Key changes: `AUTOINCREMENT` → `GENERATED ALWAYS AS IDENTITY`, add RLS policies, add a `created_at`/`updated_at` convention Supabase tooling expects.

```sql
-- supabase/migrations/0001_init.sql

create table schools (
  id bigint generated always as identity primary key,
  name text not null,
  aliases text,
  city text default 'Yangon',
  curriculum_hint text,
  is_synthetic boolean default false,
  notes text,
  created_at timestamptz default now()
);

create table sources (
  id bigint generated always as identity primary key,
  name text not null,
  type text not null check (type in ('official','school','independent','community')),
  base_reliability numeric not null default 0.5,
  url text,
  notes text
);

create table claims (
  id bigint generated always as identity primary key,
  school_id bigint not null references schools(id) on delete cascade,
  source_id bigint not null references sources(id) on delete cascade,
  field_name text not null,
  value_text text not null,
  value_numeric numeric,
  status text not null default 'unverified'
    check (status in ('school-provided','independent','community-reported','official','unverified')),
  source_date date not null,
  evidence_note text,
  created_at timestamptz default now()
);

create index idx_claims_school_field on claims(school_id, field_name);

-- Row Level Security: public can READ everything (this is a public evidence platform),
-- only an authenticated admin role can WRITE.
alter table schools enable row level security;
alter table sources enable row level security;
alter table claims enable row level security;

create policy "public read schools" on schools for select using (true);
create policy "public read sources" on sources for select using (true);
create policy "public read claims" on claims for select using (true);

create policy "admin write schools" on schools for insert with check (auth.role() = 'authenticated');
create policy "admin write claims" on claims for insert with check (auth.role() = 'authenticated');
-- repeat insert/update/delete policies per table, restricted to authenticated admin
```

**Skip the `conflicts` table** from your original design — recompute conflicts on read instead of storing them. At 5–8 schools this costs nothing in performance and means there's no stale-cache bug to worry about during a live demo.

---

## 4. Confidence Engine (TypeScript port)

Direct port of your tested `confidence_engine.py` logic — same thresholds, same reasoning, so the behavior you already validated carries over exactly.

```typescript
// lib/confidence.ts
type Claim = {
  id: number;
  value_text: string;
  value_numeric: number | null;
  source_date: string;
  source_type: 'official' | 'school' | 'independent' | 'community';
  base_reliability: number;
};

type ConfidenceResult = {
  tier: 'Supported' | 'Uncertain' | 'Unknown';
  score: number;
  reason: string;
  conflicts: { a: Claim; b: Claim; note: string }[];
};

const NUMERIC_CONFLICT_THRESHOLD = 0.15;

export function computeConfidence(claims: Claim[]): ConfidenceResult {
  if (claims.length === 0) {
    return { tier: 'Unknown', score: 0, reason: 'No evidence found for this field.', conflicts: [] };
  }

  const conflicts: ConfidenceResult['conflicts'] = [];
  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      const a = claims[i], b = claims[j];
      if (a.value_numeric != null && b.value_numeric != null) {
        const diff = Math.abs(a.value_numeric - b.value_numeric) / Math.max(Math.abs(a.value_numeric), Math.abs(b.value_numeric));
        if (diff > NUMERIC_CONFLICT_THRESHOLD) {
          conflicts.push({ a, b, note: `Numeric values differ by ${(diff * 100).toFixed(0)}%` });
        }
      } else if (a.value_text.trim().toLowerCase() !== b.value_text.trim().toLowerCase()) {
        conflicts.push({ a, b, note: `Text values differ: "${a.value_text}" vs "${b.value_text}"` });
      }
    }
  }

  const distinctSourceTypes = new Set(claims.map(c => c.source_type)).size;

  if (conflicts.length > 0) {
    const score = Math.min(55, 30 + 10 * distinctSourceTypes);
    return {
      tier: 'Uncertain', score, conflicts,
      reason: `${conflicts.length} conflicting claim(s) across ${distinctSourceTypes} source type(s) — shown as uncertain until resolved.`,
    };
  }

  const mostRecentDays = Math.min(...claims.map(c => daysSince(c.source_date)));
  const avgReliability = claims.reduce((s, c) => s + c.base_reliability, 0) / claims.length;

  let score = 25 + Math.min(30, 15 * (distinctSourceTypes - 1)) + 20 * avgReliability;
  score += mostRecentDays <= 182 ? 15 : mostRecentDays <= 365 ? 5 : 0;
  score = Math.min(95, Math.round(score));

  return {
    tier: score >= 70 ? 'Supported' : 'Uncertain', score, conflicts,
    reason: `${claims.length} claim(s) from ${distinctSourceTypes} source type(s), most recent ${mostRecentDays} days old, no conflicts.`,
  };
}

function daysSince(dateStr: string): number {
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}
```

Write a quick test (`lib/confidence.test.ts` with Vitest) reproducing your two known cases — the 10:1/12:1 conflict and the zero-claims Unknown school — so you have the same "100% on planted test cases" number for the app itself, not just the Python prototype.

---

## 5. AI Integration

### Extraction (admin-only tool, not public-facing)

A simple internal page where you paste raw text (a Facebook post, a website snippet) and Claude returns structured claim candidates for you to review before they touch the real database. This is both the fastest way for you to populate real data and the literal "AI extraction" demo moment for your pitch.

```typescript
// app/api/extract/route.ts
import { anthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import { z } from 'zod';

const ClaimSchema = z.object({
  field_name: z.enum(['tuition_fee','student_teacher_ratio','curriculum','class_size','transportation','grades_offered']),
  value_text: z.string(),
  value_numeric: z.number().nullable(),
  evidence_note: z.string(),
});

export async function POST(req: Request) {
  const { rawText, schoolName } = await req.json();

  const { object } = await generateObject({
    model: anthropic('claude-sonnet-4-6'),
    schema: z.object({ claims: z.array(ClaimSchema) }),
    prompt: `Extract structured claims about "${schoolName}" from this text. Only extract facts explicitly stated — never infer or guess a value that isn't present. Text:\n\n${rawText}`,
  });

  return Response.json(object); // reviewed by a human before insertion — never auto-inserted
}
```

**Important:** never auto-insert extracted claims directly into the database. Route extraction output to a review screen first — this preserves your "AI never fills gaps with guesses" principle and gives you a natural admin workflow for the two weeks of data collection ahead.

### RAG Q&A demo

Given your dataset is small and fully structured (not documents needing chunking), skip a real vector-search RAG pipeline — it would be over-engineering at this scale. Instead: look up the relevant claims directly by school + field name, and hand them to Claude only to phrase the answer in plain language, never to supply facts from its own knowledge.

```typescript
// app/api/ask/route.ts
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export async function POST(req: Request) {
  const { schoolId, question } = await req.json();
  const claims = await getRelevantClaims(schoolId, question); // your own retrieval, not vector search

  if (claims.length === 0) {
    return Response.json({ answer: "I couldn't find sufficiently reliable evidence to confirm this.", tier: 'Unknown' });
  }

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: 'Answer ONLY using the provided claims. Never add outside knowledge. Cite source and confidence tier.',
    prompt: `Claims: ${JSON.stringify(claims)}\n\nQuestion: ${question}`,
  });

  return result.toTextStreamResponse();
}
```

---

## 6. UI/UX — Designed for Parents, Not Developers

Your persona researches on her phone, in short sessions, under time pressure. Design for that directly:

- **Mobile-first, not mobile-adapted.** Design the phone layout first; scale up to desktop, not the reverse. Large tap targets (44px minimum), no hover-dependent interactions.
- **Color-coded badges are your entire UI language.** 🟢🟡🔴 should be the first thing visible on any school card — bigger and more prominent than the school's name, if anything. On first visit, show a one-time, dismissible tooltip explaining what each color means — don't assume anyone reads a legend.
- **Progressive disclosure.** Card view shows the badge + one-line summary. Tapping expands to the full evidence (sources, dates, conflicting values). Never show raw database fields or dense tables to a parent.
- **Design the 🔴 Unknown state with care.** "Unknown" should read as calm and informative, not broken or alarming — e.g. "No verified information yet — here's how to find out" with a suggested next step, not a bare gray box.
- **Trust signals stay visible, not buried.** Source name and date should be visible without a click, even in the compact card view — that visibility *is* the product's value proposition.
- **Skeleton loading states**, not spinners, for anything querying Supabase — feels faster and is the current standard (used in essentially every serious 2026 web app).
- **Plain language over jargon.** "2 sources agree" beats "corroboration count: 2." Write every microcopy string as if reading it aloud to a parent, not a developer.
- **Keep Burmese-language support in mind structurally**, even if English-only for the competition demo — avoid hardcoding English strings inline; centralize copy in one file so i18n is a later addition, not a rewrite.

---

## 7. Route Map

```
/                       → search/landing, big search bar, no clutter
/schools/[id]           → school detail: confidence badges per field, match score, Q&A box
/ask                    → standalone Q&A demo (or embedded in school page)
/admin/import           → paste-text-and-extract tool (auth-protected)
/admin/review           → approve/edit AI-extracted claims before they go live
```

---

## 8. Suggested Folder Structure

```
schoollens/
├── app/
│   ├── page.tsx                    # landing/search
│   ├── schools/[id]/page.tsx       # school detail (Server Component)
│   ├── admin/import/page.tsx
│   ├── admin/review/page.tsx
│   └── api/
│       ├── extract/route.ts
│       └── ask/route.ts
├── components/
│   ├── ConfidenceBadge.tsx
│   ├── SchoolCard.tsx
│   ├── ClaimRow.tsx
│   └── ui/                         # shadcn components live here
├── lib/
│   ├── confidence.ts                # ported engine
│   ├── confidence.test.ts
│   └── supabase/
│       ├── client.ts                # browser client
│       └── server.ts                # Server Component client
├── supabase/
│   └── migrations/0001_init.sql
└── seed/
    └── seed_data.json               # same shape as your existing template
```

---

## 9. Working in Cursor with Claude — Practical Workflow

1. **Start by feeding Cursor your existing work as context**, not asking it to invent from scratch. Open `schema.sql`, `confidence_engine.py`, and `seed_data_template.json` in the editor tabs (or `@`-reference them in chat) before asking for the Postgres port — this gets you a faithful translation of logic you've already tested, not a reinvention that might behave differently.

2. **Add a `.cursorrules` file** at the project root so every Claude request in this repo follows your conventions automatically:

```
# .cursorrules
- This is a Next.js 16 App Router + TypeScript + Supabase project.
- Never store secrets in code — always read from process.env.
- Confidence scoring logic lives ONLY in lib/confidence.ts — do not reimplement inline.
- Claims are never auto-inserted from AI extraction — always route through a human review step.
- Prefer Server Components for anything that only reads data.
- Use Tailwind + shadcn/ui components; do not introduce another UI library.
- Match the existing color palette: primary #028090, secondary #00A896, accent #02C39A.
- Confidence tiers are exactly: Supported (🟢) / Uncertain (🟡) / Unknown (🔴) — no other states.
```

3. **Build in this order, one focused Cursor session per step** (matches the priority list from your pitch prep):
   - Scaffold Next.js + Tailwind + shadcn/ui, deploy an empty shell to Vercel immediately — get the pipeline working before building features into it.
   - Supabase migration + RLS policies; connect via the Vercel–Supabase integration.
   - Port `lib/confidence.ts` + its test, referencing the Python file directly.
   - Seed script (port `db.py`'s import logic to a Node script or Supabase SQL seed).
   - School detail page + `ConfidenceBadge` component — this is your most important UI surface, build it before anything else.
   - `/api/extract` + review screen.
   - `/api/ask` + Q&A UI.
   - Landing/search page last — it's the least differentiated part of the product.

4. **Commit after every working step**, not at the end of a session — Cursor's Claude model works best correcting or extending a known-good state, and you want rollback points before your deadline, not after something breaks.

---

## 10. Deployment Checklist

1. `supabase init` locally, push schema via `supabase db push`, confirm RLS policies with the Supabase dashboard's policy simulator.
2. Connect the GitHub repo to Vercel; install the official **Vercel–Supabase integration** so env vars sync automatically instead of copy-pasting keys.
3. Set `ANTHROPIC_API_KEY` in Vercel's environment variables (never commit it).
4. Every push to `main` auto-deploys; every PR gets a preview URL — use preview URLs to test each feature before merging, especially anything touching the confidence engine.
5. Before the pitch: do one full deploy-and-click-through on the actual production URL, on an actual phone, not just localhost — this is exactly what a judge will do if they're curious.

---

## 11. Rough Cost Note

At this scale (5–8 schools, low request volume, competition demo), you'll comfortably stay within Supabase's and Vercel's free tiers. Claude API usage for extraction + Q&A at this volume runs a few dollars at most — budget roughly $10–20 total for the whole two-week build, not a recurring concern.
