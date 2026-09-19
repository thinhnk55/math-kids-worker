-- Migration: Initial Schema for math-kids-worker

-- 1. Profiles: Hồ sơ người học (thiết lập nickname, avatar, độ tuổi, cấp lớp)
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  grade_level TEXT, -- vd: 'preschool', 'grade_1', 'grade_2', 'grade_3'
  birth_year INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. Taxonomies: Phân loại danh mục cho khoá học (độ tuổi, chủ đề: hình học, số học, tư duy logic, v.v.)
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

-- 3. Courses: Danh sách khoá học
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

-- 4. Lessons: Danh sách bài học thuộc khoá học (có thể nhóm theo chương - chapter)
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

-- 5. Learner Courses: Lưu đăng ký khoá học hoặc đánh dấu yêu thích
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

-- 6. Learner Lessons: Lưu lịch sử học tập theo từng bài học
CREATE TABLE IF NOT EXISTS learner_lessons (
  user_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed'
  score INTEGER DEFAULT 0,
  stars INTEGER DEFAULT 0, -- 1 đến 3 sao
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, lesson_id),
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_learner_lessons_user_course ON learner_lessons(user_id, course_id);

-- 7. Roadmaps: Lộ trình học đề xuất cho trẻ (xâu chuỗi các course nên học theo thứ tự)
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

-- Bảng liên kết Roadmap và Courses theo thứ tự
CREATE TABLE IF NOT EXISTS roadmap_courses (
  roadmap_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (roadmap_id, course_id),
  FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_roadmap_courses_step ON roadmap_courses(roadmap_id, step_order);
