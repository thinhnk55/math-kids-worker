-- 2. Taxonomies: Phân loại danh mục cho khoá học (độ tuổi, chủ đề toán, cấp độ)
CREATE TABLE IF NOT EXISTS taxonomies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- vd: 'age_group', 'math_topic', 'level'
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_taxonomies_type ON taxonomies(type);
CREATE INDEX IF NOT EXISTS idx_taxonomies_code ON taxonomies(code);
