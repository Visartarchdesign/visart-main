CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  title_uz TEXT NOT NULL,
  title_ru TEXT NOT NULL,
  type_uz TEXT NOT NULL,
  type_ru TEXT NOT NULL,
  desc_uz TEXT DEFAULT '',
  desc_ru TEXT DEFAULT '',
  thumb_url TEXT NOT NULL,
  hero_url TEXT NOT NULL,
  gallery_urls TEXT DEFAULT '[]',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role_uz TEXT DEFAULT '',
  role_ru TEXT DEFAULT '',
  quote_uz TEXT NOT NULL,
  quote_ru TEXT NOT NULL,
  stars INTEGER DEFAULT 5,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('phone', '+998 90 000 00 00'),
  ('email', 'info@visartdesign.uz'),
  ('telegram', '@visartdesign'),
  ('instagram', '@visartdesign'),
  ('address_uz', 'Toshkent shahri'),
  ('address_ru', 'г. Ташкент'),
  ('stats_years', '5'),
  ('stats_projects', '100'),
  ('pricing_json', '{}');
