-- 4. Lessons: Danh sách bài học thuộc khoá học (nhóm theo chương)
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  chapter_title TEXT NOT NULL DEFAULT 'Chương 1',
  title TEXT NOT NULL,
  subtitle TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id, sort_order);
