-- 3. Courses: Danh sách khoá học và liên kết với taxonomy_terms
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'published', -- 'draft', 'published', 'archived'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);

-- Bảng liên kết Course và Taxonomy Term (N - N)
CREATE TABLE IF NOT EXISTS course_taxonomy_terms (
  course_id TEXT NOT NULL,
  taxonomy_term_id TEXT NOT NULL,
  PRIMARY KEY (course_id, taxonomy_term_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (taxonomy_term_id) REFERENCES taxonomy_terms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_terms_term ON course_taxonomy_terms(taxonomy_term_id);
