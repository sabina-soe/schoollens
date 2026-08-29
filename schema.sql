-- Myanmar AI School Decision Platform — Competition MVP Schema
-- SQLite for the demo build. Same shape ports to Postgres later
-- (swap AUTOINCREMENT -> SERIAL/IDENTITY, add pgvector column when needed).

PRAGMA foreign_keys = ON;

-- A school profile. Deliberately minimal for the demo.

CREATE TABLE schools (
    id              BIGINT Generated always as identity PRIMARY KEY,
    name            TEXT NOT NULL,
    aliases         TEXT,              -- comma-separated, for entity resolution demo (e.g. "ISY, International School Yangon")
    city            TEXT DEFAULT 'Yangon',
    curriculum_hint TEXT,              -- free text, e.g. "British / Cambridge" — not authoritative, just for display
    is_synthetic    BOOLEAN DEFAULT 0, -- 1 if this school/profile is illustrative, not real — MUST be shown in the UI
    notes           TEXT,
    created_at      timestamptz default now()
);

-- Where a piece of information came from.
-- type is the four-category model from the spec: official / school / independent / community

CREATE TABLE sources (
    id              BIGINT Generated always AS IDENTITY PRIMARY KEY,
    name            TEXT NOT NULL,           -- e.g. "School Facebook Page", "doris.school", "Edge.com.mm"
    type            TEXT NOT NULL CHECK (type IN ('official', 'school', 'independent', 'community')),
    base_reliability numeric NOT NULL DEFAULT 0.5,  -- 0.0-1.0, your editorial judgment of this source class's default trustworthiness
                                                   -- e.g. school's own site for its own bus routes = high; a paid-listing directory = lower
    url             TEXT,
    notes           TEXT                     -- e.g. "Commercial directory, paid listings — treat as uncorroborated unless confirmed"
);

-- The core object: one claim about one school, from one source, as of one date.
-- field_name is a controlled vocabulary — keep it small and consistent for the demo.
-- Suggested field_names: tuition_fee, student_teacher_ratio, class_size, curriculum,
--                        transportation, grades_offered, established_year
CREATE TABLE claims (
    id              BIGINT Generated always AS IDENTITY PRIMARY KEY,
    school_id       bigint not null references schools(id) on delete cascade,
    source_id       bigint not null references sources(id) on delete cascade,
    field_name      TEXT NOT NULL,
    value_text      TEXT NOT NULL,           -- human-readable claim value, e.g. "10:1" or "7,000,000 MMK" or "Cambridge IGCSE"
    value_numeric   numeric,                    -- optional parsed numeric form, for automatic numeric comparison (fees, ratios, class sizes)
    status          TEXT NOT NULL DEFAULT 'unverified'
                      CHECK (status IN ('school-provided', 'independent', 'community-reported', 'official', 'unverified')),
    source_date     date NOT NULL,           -- ISO date, e.g. "2026-08-01" — when the SOURCE says this was true, not when you entered it
    evidence_note   TEXT,                    -- short note on the underlying evidence, e.g. "Facebook post dated 2 Aug 2026" or "school website /admissions page"
    created_at      timestamptz DEFAULT NOW()
);

-- A detected disagreement between two claims about the same field for the same school.
-- Populated by the confidence engine, not entered by hand.
-- CREATE TABLE conflicts (
    -- id              INTEGER PRIMARY KEY AUTOINCREMENT,
    -- school_id       INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    -- field_name      TEXT NOT NULL,
    -- claim_id_a      INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    -- claim_id_b      INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    -- detected_at     TEXT DEFAULT CURRENT_TIMESTAMP,
    -- note            TEXT
-- );

CREATE INDEX idx_claims_school_field ON claims(school_id, field_name);

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

-- CREATE INDEX idx_conflicts_school_field ON conflicts(school_id, field_name);
