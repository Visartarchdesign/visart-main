-- Mijozga balans/muzlatish eslatmalari holati (service_role orqali ishlaydi)
create table if not exists balans_eslatma (
  obyekt_id text primary key,
  chegara int,            -- oxirgi yuborilgan chegara (mln so'm: 3,2,1); null = yuborilmagan
  muzlat_sana date,       -- muzlatilgan holat eslatmasi oxirgi yuborilgan kun (Toshkent)
  updated_at timestamptz default now()
);
alter table balans_eslatma enable row level security;
