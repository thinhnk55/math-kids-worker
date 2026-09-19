-- 1. Profiles: Hồ sơ người học (mỗi người dùng tối đa 3 profile con)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  birth_year INTEGER,
  avatar TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
