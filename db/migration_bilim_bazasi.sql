-- Visart bilim bazasi: norma -> tekshiruv -> rabochka -> hujjat -> yuborish. Supabase SQL Editor'da bir marta.
create table if not exists norma_manba (            -- 1) hujjatlar (ShNQ, QMQ, davlat standarti, ichki qoida)
  id bigserial primary key, kod text not null, nom text, tur text,   -- shnq|qmq|gost|ozdst|ichki
  versiya text, kuchga_kirgan date, havola text, izoh text, unique(kod, versiya)
);
create table if not exists norma_qoidalari (        -- 2) mashinaviy tekshiriladigan qoidalar
  id bigserial primary key, manba_id bigint references norma_manba(id) on delete cascade,
  band text not null,                               -- manbadagi band raqami (tekshirish uchun majburiy)
  soha text not null,                               -- arxitektura|interyer|elektr|santexnika|ventilyatsiya|yongin|ergonomika
  obyekt_turi text,                                 -- xonadon|uy|ofis|do'kon|...
  xona_turi text,                                   -- yotoqxona|oshxona|sanuzel|yo'lak|...
  parametr text not null,                           -- eshik_eni|shift_balandligi|zina_eni|...
  operator text not null check (operator in ('>=','<=','=','between','bor','yoq')),
  qiymat_min numeric, qiymat_max numeric, birlik text,
  jiddiylik text default 'xato' check (jiddiylik in ('xato','ogohlantirish','tavsiya')),
  izoh text, tasdiqlangan boolean default false, rad_etilgan boolean default false, created_at timestamptz default now()
);
create index if not exists norma_qoidalari_idx on norma_qoidalari(soha, xona_turi, parametr);
create table if not exists material_bazasi (        -- 3) O'zbekiston bozoriga moslangan material/jihoz
  id bigserial primary key, toifa text, nom text not null, brend text, ishlab_chiqaruvchi text,
  birlik text, narx_uzs numeric, narx_sanasi date, yetkazuvchi text, mavjud_uzbekistonda boolean default true,
  olcham text, texnik_jadval jsonb, izoh text
);
create table if not exists rabochka_talablari (     -- 4) rabochka (ishchi chizma) varaqlari va ularda bo'lishi shart narsalar
  id bigserial primary key, varaq_turi text not null,  -- reja|kesim|devor_yozuvi|pol|shift|elektr|santexnika|detal|spetsifikatsiya
  talab text not null, majburiy boolean default true, tartib int, izoh text
);
create table if not exists loyiha_tekshiruvi (      -- 5) tekshiruv natijalari (qaysi loyiha, qaysi qoida, natija)
  id bigserial primary key, loyiha text not null, qoida_id bigint references norma_qoidalari(id),
  topilgan_qiymat numeric, natija text check (natija in ('otdi','xato','ogohlantirish')), izoh text,
  created_at timestamptz default now()
);
alter table norma_manba enable row level security; alter table norma_qoidalari enable row level security;
alter table material_bazasi enable row level security; alter table rabochka_talablari enable row level security;
alter table loyiha_tekshiruvi enable row level security;
