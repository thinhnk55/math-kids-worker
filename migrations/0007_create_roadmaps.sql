-- 7. Roadmaps: Lộ trình học đề xuất và các chặng khoá học
CREATE TABLE IF NOT EXISTS roadmaps (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  age_range TEXT, -- vd: '4 - 6 tuổi', 'Tiểu học'
  status TEXT NOT NULL DEFAULT 'published',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Bảng liên kết Roadmap và Courses theo thứ tự bước học
CREATE TABLE IF NOT EXISTS roadmap_courses (
  roadmap_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (roadmap_id, course_id),
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_roadmap_courses_step ON roadmap_courses(roadmap_id, step_order);
