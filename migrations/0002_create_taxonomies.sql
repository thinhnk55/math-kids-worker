-- 2. Taxonomies & Taxonomy Terms: Hệ thống phân loại danh mục tổng quan và các thuật ngữ cụ thể

-- 1. Taxonomies (Nhóm phân loại: 'math_topic', 'age_group', 'grade_level', 'difficulty'...)
CREATE TABLE IF NOT EXISTS taxonomies (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_taxonomies_code ON taxonomies(code);

-- 2. Taxonomy Terms (Các giá trị cụ thể trong nhóm: 'addition', 'geometry', 'age_4_5'...)
CREATE TABLE IF NOT EXISTS taxonomy_terms (
  id TEXT PRIMARY KEY,
  taxonomy_id TEXT NOT NULL,
  parent_id TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (taxonomy_id) REFERENCES taxonomies(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
  UNIQUE (taxonomy_id, code)
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_tax ON taxonomy_terms(taxonomy_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_parent ON taxonomy_terms(parent_id);
