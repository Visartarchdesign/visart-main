-- Chiquvchi xabarlar jurnali (outbox): yuborildi / qayta uriniladi / xato. service_role orqali ishlaydi.
create table if not exists xabar_navbati (
  id bigserial primary key,
  chat_id text not null,
  matn text not null,
  tur text,
  obyekt_id text,
  kalit text unique,                       -- takror yuborishdan himoya (ixtiyoriy)
  holat text not null default 'kutilmoqda' check (holat in ('kutilmoqda','yuborildi','xato')),
  urinish int not null default 0,
  keyingi_urinish timestamptz not null default now(),
  xato_matni text,
  yaratilgan timestamptz not null default now(),
  yuborilgan timestamptz
);
create index if not exists xabar_navbati_holat_idx on xabar_navbati (holat, keyingi_urinish);
alter table xabar_navbati enable row level security;
