-- SchoolLens initial schema (Postgres / Supabase)
-- Public evidence platform: anyone can read schools/sources/claims.
-- Writes + all pending_claims access: single shared admin UID only.

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
  type text not null check (type in ('official', 'school', 'independent', 'community')),
  base_reliability numeric not null default 0.5,
  url text,
  notes text
);

create table claims (
  id bigint generated always as identity primary key,
  school_id bigint not null references schools(id) on delete cascade,
  source_id bigint not null references sources(id) on delete cascade,
  field_name text not null
    check (field_name in (
      'tuition_fee',
      'student_teacher_ratio',
      'curriculum',
      'class_size',
      'transportation',
      'grades_offered',
      'established_year'
    )),
  value_text text not null,
  value_numeric numeric,
  status text not null default 'unverified'
    check (status in (
      'school-provided',
      'independent',
      'community-reported',
      'official',
      'unverified'
    )),
  source_date date not null,
  evidence_note text,
  created_at timestamptz default now()
);

-- AI extraction staging: mirrors claim payload columns, with review workflow status
-- instead of claims.status provenance. On approve, copy into claims (typically as unverified
-- or with a provenance status chosen in the review UI) and set status = 'approved' here.
create table pending_claims (
  id bigint generated always as identity primary key,
  school_id bigint not null references schools(id) on delete cascade,
  source_id bigint not null references sources(id) on delete cascade,
  field_name text not null
    check (field_name in (
      'tuition_fee',
      'student_teacher_ratio',
      'curriculum',
      'class_size',
      'transportation',
      'grades_offered',
      'established_year'
    )),
  value_text text not null,
  value_numeric numeric,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  source_date date not null,
  evidence_note text,
  created_at timestamptz default now(),
  raw_source_text text,
  extracted_at timestamptz default now()
);

create index idx_claims_school_field on claims(school_id, field_name);
create index idx_pending_claims_status on pending_claims(status);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table schools enable row level security;
alter table sources enable row level security;
alter table claims enable row level security;
alter table pending_claims enable row level security;

-- Public read (evidence platform). No public policies on pending_claims.
create policy "public read schools"
  on schools for select
  using (true);

create policy "public read sources"
  on sources for select
  using (true);

create policy "public read claims"
  on claims for select
  using (true);

-- Solo admin: hardcoded Auth UID (competition demo — no roles table).
-- Insert / update / delete on all four tables.
create policy "admin insert schools"
  on schools for insert
  with check (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

create policy "admin update schools"
  on schools for update
  using (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21')
  with check (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

create policy "admin delete schools"
  on schools for delete
  using (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

create policy "admin insert sources"
  on sources for insert
  with check (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

create policy "admin update sources"
  on sources for update
  using (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21')
  with check (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

create policy "admin delete sources"
  on sources for delete
  using (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

create policy "admin insert claims"
  on claims for insert
  with check (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

create policy "admin update claims"
  on claims for update
  using (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21')
  with check (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

create policy "admin delete claims"
  on claims for delete
  using (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

-- pending_claims: admin-only for all operations (including select)
create policy "admin select pending_claims"
  on pending_claims for select
  using (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

create policy "admin insert pending_claims"
  on pending_claims for insert
  with check (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

create policy "admin update pending_claims"
  on pending_claims for update
  using (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21')
  with check (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');

create policy "admin delete pending_claims"
  on pending_claims for delete
  using (auth.uid() = '0d786188-abb7-48ee-90f3-25d6c554da21');
