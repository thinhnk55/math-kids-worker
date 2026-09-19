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
