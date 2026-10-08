-- Mijoz boti: til (uz/ru), tasdiqlangan telefon, lid javoblari, rasm limiti
-- Supabase "Visart hisobot" > SQL Editor, BIR MARTA.
create table if not exists mijoz_profil (
  chat_id bigint primary key,
  til text not null default 'uz',
  tel text,
  byudjet text,
  muddat text,
  hudud text,
  ball int,
  foto_kun text,
  foto_son int default 0,
  updated_at timestamptz not null default now()
);
alter table mijoz_profil enable row level security;  -- faqat service_role (bot) kiradi
