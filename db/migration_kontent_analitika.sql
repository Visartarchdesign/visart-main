-- Kontent analitikasi: nashr qilingan kontent reyestri + vaqt bo'yicha metrika suratlari.
-- Supabase SQL Editor'da bir marta ishga tushiring.
create table if not exists kontent_nashr (
  id bigint generated always as identity primary key,
  platforma text not null,              -- instagram | youtube | telegram | facebook
  tashqi_id text not null,              -- platformadagi ID (IG media id, YT video id)
  format text,                          -- REELS | CAROUSEL_ALBUM | IMAGE | SHORTS | LONG
  url text,
  sarlavha text,
  kategoriya text default 'nomalum',    -- 10 ta kontent kategoriyasidan biri
  nashr_vaqti timestamptz,
  davomiylik_s int,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (platforma, tashqi_id)
);
create index if not exists kontent_nashr_vaqt_idx on kontent_nashr (platforma, nashr_vaqti desc);

create table if not exists kontent_metrika (
  id bigint generated always as identity primary key,
  nashr_id bigint not null references kontent_nashr(id) on delete cascade,
  soat int not null,                    -- nashrdan keyingi yosh (24/72/168/672 bosqich)
  metrika jsonb not null,               -- {views, reach, saved, shares, likes, comments, avg_watch_ms, ...}
  olingan timestamptz not null default now(),
  unique (nashr_id, soat)
);

alter table kontent_nashr enable row level security;
alter table kontent_metrika enable row level security;
