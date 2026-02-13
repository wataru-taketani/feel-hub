-- 006_waitlist.sql
-- ウェイトリスト（キャンセル待ち通知）

-- waitlist テーブル
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  notified BOOLEAN NOT NULL DEFAULT FALSE,
  auto_reserve BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own waitlist entries"
  ON waitlist FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 未通知エントリの部分インデックス（Lambda検索用）
CREATE INDEX idx_waitlist_not_notified
  ON waitlist (lesson_id)
  WHERE notified = FALSE;

-- user_profiles に LINE User ID カラム追加
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS line_user_id TEXT;
