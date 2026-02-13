-- 004_fix_attendance_history.sql
-- attendance_history テーブルのスキーマ修正
-- テーブルが空のため、DROPして正しいスキーマで再作成

DROP TABLE IF EXISTS attendance_history;

CREATE TABLE attendance_history (
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
