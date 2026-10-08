-- Xatolar jurnali (jim uzilishlarni ko'rish uchun). Supabase SQL Editor'da bir marta ishga tushiring.
create table if not exists bot_xatolar (
  id bigserial primary key,
  manba text not null,
  xabar text,
  created_at timestamptz default now()
);
create index if not exists bot_xatolar_manba_vaqt on bot_xatolar (manba, created_at desc);
alter table bot_xatolar enable row level security;

-- Cron monitoringi: har cron oxirgi ishlagan vaqtini shu yerga yozadi
create table if not exists bot_yurak (
  nom text primary key,
  oxirgi timestamptz not null default now()
);
alter table bot_yurak enable row level security;
