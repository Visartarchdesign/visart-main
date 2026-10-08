-- Telegram update takrorlanishidan himoya (site Supabase: "Visart hisobot" > SQL Editor)
create table if not exists bot_update_log (
  update_id bigint primary key,
  created_at timestamptz not null default now()
);
alter table bot_update_log enable row level security;  -- faqat service_role kiradi
create index if not exists bot_update_log_created on bot_update_log (created_at);
