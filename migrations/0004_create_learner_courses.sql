-- 5. Learner Courses: Lưu trạng thái đăng ký khoá học hoặc yêu thích theo từng profile
CREATE TABLE IF NOT EXISTS learner_courses (
  profile_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'enrolled', -- 'enrolled' (đã đăng ký), 'favorite' (yêu thích), 'completed' (hoàn thành)
  score INTEGER DEFAULT 0,
  meta TEXT, -- JSON linh hoạt (lưu certificate, overall_stars, stats...)
  last_lesson_id INTEGER,
  enrolled_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (profile_id, course_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learner_courses_profile ON learner_courses(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_learner_courses_user ON learner_courses(user_id);
