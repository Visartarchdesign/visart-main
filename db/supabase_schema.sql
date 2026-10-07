-- Visart Design — Supabase (Postgres) sxemasi
-- Bu fayl kodda tarqalgan (functions/api/*.js) barcha Supabase jadvallarini
-- BITTA joyga yig'adi -- Supabase loyihasi yaratilgandan keyin SQL Editor'da
-- BIR MARTA, to'liq ishga tushiring.
--
-- ESLATMA: `obyekt_id` ustunlari hammasi ERKIN MATN (text) -- bu repo ichida
-- `obyektlar` jadvali YO'Q, bu ID tashqi "VISART_YAKUNIY" tizimidan keladi
-- deb kutiladi (mijoz-bot.js'dagi izohga qarang). Agar hali VISART_YAKUNIY
-- mavjud bo'lmasa, visart-events.js/mijoz-kunlik-xabar.js/usta-eslatma.js
-- funksiyalari HECH NARSA qilmaydi (kirish ma'lumoti yo'q) -- lekin xato
-- ham bermaydi, shunchaki bo'sh navbat bilan ishlaydi.

-- ===== Media/AI agent (Senarist + Montajchi + nashr navbati) =====

create table if not exists media_arxiv (
  id bigint generated always as identity primary key,
  telegram_chat_id bigint not null,
  telegram_message_id bigint not null,
  turi text not null,
  izoh text,
  file_id text,
  asl_file_id text,
  media_group_id text,
  holat text not null default 'yangi',
  created_at timestamptz not null default now()
);

create table if not exists media_taklif (
  id bigint generated always as identity primary key,
  matn text not null,
  media_arxiv_id bigint,
  media_arxiv_idlar text,
  holat text not null default 'kutilmoqda',
  created_at timestamptz not null default now()
);

create table if not exists nashr_navbati (
  id bigint generated always as identity primary key,
  turi text not null,
  payload jsonb not null,
  nashr_vaqti timestamptz not null,
  holat text not null default 'kutilmoqda',
  xato_matni text,
  created_at timestamptz not null default now()
);
create index if not exists nashr_navbati_holat_vaqt_idx on nashr_navbati (holat, nashr_vaqti);

-- ===== Mijoz-bot: sotuv/lid funneli =====

create table if not exists lidlar (
  id bigint generated always as identity primary key,
  ism text not null,
  telefon text not null,
  xizmat_turi text,
  maydon_m2 numeric,
  manba text,
  holat text not null default 'yangi_lid',
  created_at timestamptz not null default now()
);

create table if not exists mijoz_dialog (
  chat_id bigint primary key,
  step text not null default 'ism',
  ism text,
  telefon text,
  xizmat_turi text,
  xizmat_label text,
  maydon_m2 numeric,
  updated_at timestamptz not null default now()
);

-- ===== Mijoz-bot: obyekt guruhlari (mijoz va ustalar) =====

create table if not exists visart_loyiha_guruhlar (
  telegram_chat_id bigint primary key,
  obyekt_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_vlg_obyekt_id on visart_loyiha_guruhlar (obyekt_id);

create table if not exists usta_guruhlar (
  telegram_chat_id bigint primary key,
  obyekt_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_ug_obyekt_id on usta_guruhlar (obyekt_id);

-- ===== Kunlik hisobot (VISART_YAKUNIY'dan keladigan hodisalar navbati) =====

create table if not exists kunlik_hodisalar (
  id bigint generated always as identity primary key,
  turi text,
  obyekt_id text,
  matn text not null,
  guruh text not null,
  summa numeric,
  umumiy_summa numeric,
  qoldiq numeric,
  yuborildi boolean not null default false,
  yuborilgan_sana date,
  created_at timestamptz not null default now()
);
create index if not exists idx_kh_yuborildi on kunlik_hodisalar (yuborildi);
create index if not exists idx_kh_guruh_obyekt on kunlik_hodisalar (guruh, obyekt_id);

create table if not exists kunlik_xabar_jurnali (
  id bigint generated always as identity primary key,
  sana date not null,
  guruh text not null,
  obyekt_id text not null, -- guruh='moliya' uchun sentinel '__moliya__'
  telegram_chat_id bigint not null,
  telegram_message_id bigint not null,
  created_at timestamptz not null default now(),
  constraint uq_kxj_sana_guruh_obyekt unique (sana, guruh, obyekt_id)
);

-- ===== Supabase Storage =====
-- "public-media" bucket kod tomonidan BIRINCHI yuklashda o'zi avtomatik
-- yaratiladi (public: true) -- qo'lda yaratish shart emas.

-- ===== IZOH: `mijozlar` jadvali BU YERDA YO'Q =====
-- mijoz-bot.js'dagi izohga ko'ra `mijozlar` -- auth.uid()/RLS orqali
-- ishlaydigan, obyektga bog'langan MIJOZ PORTAL AKKAUNTI jadvali, alohida
-- "VISART_YAKUNIY" tizimiga tegishli. Agar u tizim hali yo'q bo'lsa, bu
-- jadval ham hali kerak emas -- faqat portal qurilganda qo'shiladi.
