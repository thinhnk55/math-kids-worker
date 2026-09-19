-- 6. Learner Lessons: Lưu lịch sử học tập theo từng bài học của profile
CREATE TABLE IF NOT EXISTS learner_lessons (
  profile_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  lesson_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed'
  score INTEGER DEFAULT 0,
  stars INTEGER DEFAULT 0, -- 1 đến 3 sao
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, lesson_id),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learner_lessons_profile_course ON learner_lessons(profile_id, course_id);
CREATE INDEX IF NOT EXISTS idx_learner_lessons_user ON learner_lessons(user_id);
