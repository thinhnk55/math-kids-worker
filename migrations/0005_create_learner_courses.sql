-- 5. Learner Courses: Lưu trạng thái đăng ký khoá học hoặc yêu thích
CREATE TABLE IF NOT EXISTS learner_courses (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enrolled', -- 'enrolled' (đã đăng ký), 'favorite' (yêu thích), 'completed' (hoàn thành)
  last_lesson_id TEXT,
  enrolled_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, course_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learner_courses_user ON learner_courses(user_id, status);
