-- Loyiha sahifalari (/loyihalar/:slug va /ru/proekty/:slug) uchun migratsiya.
-- Bu buyruqni Cloudflare D1 konsolida (Dashboard > D1 > sizning bazangiz > Console)
-- BIR MARTA ishga tushiring. Mavjud bazani buzmaydi, faqat ustun qo'shadi.

ALTER TABLE projects ADD COLUMN slug TEXT;
ALTER TABLE projects ADD COLUMN slug_ru TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug_ru ON projects(slug_ru);

-- Eslatma: mavjud loyihalaringiz bo'lsa, migratsiyadan keyin admin panelda
-- har birini ochib "Saqlash" tugmasini bosing — slug avtomatik yaratiladi.
