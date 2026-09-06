-- Apply moe_registration from the official MoE approved list.
-- Run in the Supabase SQL editor if Node cannot reach the API
-- (Windows TypeError: fetch failed).
--
-- MISY (Yangon / Yankin, seq 115) → Registered
-- Every other school in this database → Not listed
-- Does not delete existing non-MoE claims.

insert into sources (name, type, base_reliability, notes)
select
  'MoE approved list of private international-curriculum schools',
  'official',
  0.95,
  'Ministry of Education list under the Nov 2023 Directive. Parsed from MOE_Approve_List.xlsx.'
where not exists (
  select 1
  from sources
  where name = 'MoE approved list of private international-curriculum schools'
);

with moe_source as (
  select id
  from sources
  where name = 'MoE approved list of private international-curriculum schools'
  order by id
  limit 1
),
classified as (
  select
    s.id as school_id,
    src.id as source_id,
    case
      when s.name ilike '%Myanmar International School Yangon%'
        or coalesce(s.aliases, '') ilike '%MISY%'
      then 'Registered'
      else 'Not listed'
    end as value_text,
    case
      when s.name ilike '%Myanmar International School Yangon%'
        or coalesce(s.aliases, '') ilike '%MISY%'
      then 'Listed as "Myanmar International School Yangon (MISY)", Yankin Township, Yangon Region (seq 115). Approval period 2024-2025 to 2028-2029.'
      else 'Not found on the MoE approved list of private schools teaching the international curriculum (MOE_Approve_List.xlsx, 2026-09-06).'
    end as evidence_note
  from schools s
  cross join moe_source src
)
update claims c
set
  value_text = classified.value_text,
  value_numeric = null,
  status = 'official',
  source_date = '2026-09-06',
  evidence_note = classified.evidence_note
from classified
where c.school_id = classified.school_id
  and c.source_id = classified.source_id
  and c.field_name = 'moe_registration';

insert into claims (
  school_id,
  source_id,
  field_name,
  value_text,
  value_numeric,
  status,
  source_date,
  evidence_note
)
select
  classified.school_id,
  classified.source_id,
  'moe_registration',
  classified.value_text,
  null,
  'official',
  '2026-09-06',
  classified.evidence_note
from (
  select
    s.id as school_id,
    src.id as source_id,
    case
      when s.name ilike '%Myanmar International School Yangon%'
        or coalesce(s.aliases, '') ilike '%MISY%'
      then 'Registered'
      else 'Not listed'
    end as value_text,
    case
      when s.name ilike '%Myanmar International School Yangon%'
        or coalesce(s.aliases, '') ilike '%MISY%'
      then 'Listed as "Myanmar International School Yangon (MISY)", Yankin Township, Yangon Region (seq 115). Approval period 2024-2025 to 2028-2029.'
      else 'Not found on the MoE approved list of private schools teaching the international curriculum (MOE_Approve_List.xlsx, 2026-09-06).'
    end as evidence_note
  from schools s
  cross join (
    select id
    from sources
    where name = 'MoE approved list of private international-curriculum schools'
    order by id
    limit 1
  ) src
) classified
where not exists (
  select 1
  from claims c
  where c.school_id = classified.school_id
    and c.source_id = classified.source_id
    and c.field_name = 'moe_registration'
);

select
  s.id,
  s.name,
  s.aliases,
  c.value_text,
  c.status,
  c.source_date,
  left(c.evidence_note, 160) as evidence_note
from claims c
join schools s on s.id = c.school_id
join sources src on src.id = c.source_id
where c.field_name = 'moe_registration'
  and src.name = 'MoE approved list of private international-curriculum schools'
order by s.name;
