-- Visart Design — Admin panel D1 sxemasi

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,               -- interior | architecture | drawings
  status TEXT NOT NULL DEFAULT 'render', -- done | render
  title_uz TEXT NOT NULL,
  title_ru TEXT NOT NULL,
  type_uz TEXT NOT NULL,
  type_ru TEXT NOT NULL,
  desc_uz TEXT DEFAULT '',
  desc_ru TEXT DEFAULT '',
  thumb_url TEXT NOT NULL,
  hero_url TEXT NOT NULL,
  gallery_urls TEXT DEFAULT '[]',        -- JSON massiv (string)
  sort_order INTEGER DEFAULT 0,
  slug TEXT,                             -- /loyihalar/:slug — lotin, avtomatik yasaladi
  slug_ru TEXT,                          -- /ru/proekty/:slug — kirill, avtomatik yasaladi
  area_m2 INTEGER,
  location_uz TEXT,
  location_ru TEXT,
  year INTEGER,
  duration_uz TEXT,
  duration_ru TEXT,
  style_uz TEXT,
  style_ru TEXT,
  task_uz TEXT,
  task_ru TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug_ru ON projects(slug_ru);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role_uz TEXT DEFAULT '',
  role_ru TEXT DEFAULT '',
  quote_uz TEXT NOT NULL,
  quote_ru TEXT NOT NULL,
  stars INTEGER DEFAULT 5,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Kalit-qiymat ko'rinishidagi sozlamalar: kontakt ma'lumotlari, statistikalar,
-- va narx kalkulyatori konfiguratsiyasi (JSON string sifatida 'pricing_json' kalitida)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Boshlang'ich sozlamalar (mavjud saytdagi qiymatlar bilan bir xil)
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('phone', '+998974021515'),
  ('email', 'visartarchdesign@gmail.com'),
  ('telegram', '@visartadmin'),
  ('instagram', ''),
  ('address_uz', 'Toshkent, Uchtepa tumani'),
  ('address_ru', 'Ташкент, Учтепинский район'),
  ('stats_years', '10+'),
  ('stats_projects', '200+'),
  ('pricing_json', '{"services":[{"id":"arch","uz":"Arxitektura loyihalash","ru":"Архитектурное проектирование","rate":150000,"areaBased":true},{"id":"interior","uz":"Interyer dizayn","ru":"Дизайн интерьера","rate":200000,"areaBased":true},{"id":"docs","uz":"Hujjat va nazorat","ru":"Документация и надзор","rate":0,"areaBased":false,"flat":6000000},{"id":"turnkey","uz":"Pod klyuch","ru":"Под ключ","rate":320000,"areaBased":true}],"styles":[{"id":"standard","uz":"Standart","ru":"Стандарт","mult":1},{"id":"premium","uz":"Premium","ru":"Премиум","mult":1.35},{"id":"lux","uz":"Lyuks","ru":"Люкс","mult":1.8}],"addons":[{"id":"3d","uz":"3D vizualizatsiya","ru":"3D-визуализация","flat":3000000},{"id":"supervision","uz":"Qurilish nazorati","ru":"Авторский надзор","flat":8000000},{"id":"fast","uz":"Tezlashtirilgan muddat","ru":"Ускоренные сроки","pct":0.15}]}');
