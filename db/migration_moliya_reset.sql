-- Site Supabase (Visart hisobot) SQL Editor'da bir marta: Moliya superadmin parolini Telegram orqali tiklash
create table if not exists moliya_reset (
  login text primary key,
  hash text not null,
  exp timestamptz not null,
  tries int default 0,
  last_at timestamptz default now()
);
alter table moliya_reset enable row level security;
