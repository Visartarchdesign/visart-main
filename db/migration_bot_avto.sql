-- Site Supabase SQL Editor'da bir marta (obyekt holati kuzatuvi uchun)
create table if not exists obyekt_holat_log (
  obyekt_id text primary key,
  holat text,
  updated_at timestamptz default now()
);
alter table obyekt_holat_log enable row level security;
