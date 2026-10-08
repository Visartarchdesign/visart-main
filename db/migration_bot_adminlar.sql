-- Site Supabase (Visart hisobot) SQL Editor'da bir marta.
create table if not exists bot_adminlar (
  id bigserial primary key,
  chat_id bigint unique,
  ism text,
  token text unique,
  token_exp timestamptz,
  qoshdi bigint,
  created_at timestamptz default now()
);
alter table bot_adminlar enable row level security;
