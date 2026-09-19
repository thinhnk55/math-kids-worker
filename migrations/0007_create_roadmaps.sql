-- 7. Roadmaps: Lộ trình học đề xuất và các chặng khoá học
CREATE TABLE IF NOT EXISTS roadmaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  age_range TEXT, -- vd: '4 - 6 tuổi', 'Tiểu học'
  status TEXT NOT NULL DEFAULT 'published',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Bảng liên kết Roadmap và Courses theo thứ tự bước học
CREATE TABLE IF NOT EXISTS roadmap_courses (
  roadmap_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (roadmap_id, course_id),
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_roadmap_courses_step ON roadmap_courses(roadmap_id, step_order);

-- Bảng lưu tiến trình học theo Roadmap của từng profile
CREATE TABLE IF NOT EXISTS learner_roadmaps (
  profile_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  roadmap_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed'
  current_step_order INTEGER NOT NULL DEFAULT 1,
  score INTEGER DEFAULT 0,
  meta TEXT, -- JSON linh hoạt (lưu badges, milestones, custom stats...)
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, roadmap_id),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learner_roadmaps_profile ON learner_roadmaps(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_learner_roadmaps_user ON learner_roadmaps(user_id);
