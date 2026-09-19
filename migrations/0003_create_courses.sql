-- 3. Courses: Danh sách khoá học và liên kết với taxonomies
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  cover_url TEXT,
  age_group TEXT, -- vd: '4-5 tuổi', 'Lớp 1 (6-7 tuổi)', 'Lớp 2 (7-8 tuổi)'
  level TEXT,     -- vd: 'Cơ bản', 'Nâng cao', 'Tư duy'
  color_tone TEXT DEFAULT 'orange',
  status TEXT NOT NULL DEFAULT 'published', -- 'draft', 'published', 'archived'
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);

-- Bảng liên kết Course và Taxonomy (N - N)
CREATE TABLE IF NOT EXISTS course_taxonomies (
  course_id TEXT NOT NULL,
  taxonomy_id TEXT NOT NULL,
  PRIMARY KEY (course_id, taxonomy_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (taxonomy_id) REFERENCES taxonomies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_taxonomies_tax ON course_taxonomies(taxonomy_id);
