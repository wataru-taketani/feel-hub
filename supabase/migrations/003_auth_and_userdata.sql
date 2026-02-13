-- 003_auth_and_userdata.sql
-- 認証・ユーザーデータ関連テーブル

-- user_profiles: 会員情報
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  home_store TEXT,
  membership_type TEXT,
  joined_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- feelcycle_sessions: FEELCYCLE APIセッション（暗号化保存）
-- RLSポリシーなし = service_role経由のみアクセス可
CREATE TABLE IF NOT EXISTS feelcycle_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feelcycle_sessions ENABLE ROW LEVEL SECURITY;
-- RLSポリシーなし（service_role経由のみ）

-- bookmarks: ブックマーク
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_key TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  program_name TEXT NOT NULL,
  instructor TEXT NOT NULL,
  studio TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_key)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks"
  ON bookmarks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- filter_presets: フィルタプリセット
CREATE TABLE IF NOT EXISTS filter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  filters JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE filter_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own presets"
  ON filter_presets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- attendance_history: 受講履歴キャッシュ
CREATE TABLE IF NOT EXISTS attendance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  store_name TEXT NOT NULL,
  instructor_name TEXT NOT NULL,
  program_name TEXT NOT NULL,
  genre TEXT,
  sheet_no TEXT,
  ticket_name TEXT,
  playlist_url TEXT,
  cancel_flg INTEGER DEFAULT 0,
  fetched_month TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shift_date, start_time, store_name, instructor_name)
);

ALTER TABLE attendance_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history"
  ON attendance_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
-- INSERT/UPDATEはservice_role経由のみ
