-- Feel Hub Database Schema
-- Supabaseダッシュボードで実行してください

-- ユーザーテーブル（Supabase Authと連携）
-- このテーブルは自動生成されるauth.usersテーブルと連携

-- FEELCYCLE認証情報テーブル
CREATE TABLE IF NOT EXISTS feelcycle_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_encrypted TEXT NOT NULL,  -- AES暗号化されたFEELCYCLEメールアドレス
  password_encrypted TEXT NOT NULL,  -- AES暗号化されたFEELCYCLEパスワード
  line_notify_token TEXT,  -- LINE Notify トークン
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- レッスン情報テーブル
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  time TIME NOT NULL,
  program_name TEXT NOT NULL,
  instructor TEXT NOT NULL,
  studio TEXT NOT NULL,
  available_slots INTEGER NOT NULL DEFAULT 0,
  total_slots INTEGER NOT NULL DEFAULT 20,
  is_full BOOLEAN DEFAULT FALSE,
  url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date, time, studio, instructor)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons(date);
CREATE INDEX IF NOT EXISTS idx_lessons_studio ON lessons(studio);
CREATE INDEX IF NOT EXISTS idx_lessons_is_full ON lessons(is_full);

-- キャンセル待ちリストテーブル
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  auto_reserve BOOLEAN DEFAULT FALSE,  -- 自動予約するか
  notified BOOLEAN DEFAULT FALSE,  -- 通知済みか
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON waitlist(user_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_notified ON waitlist(notified);

-- 受講履歴テーブル
CREATE TABLE IF NOT EXISTS attendance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_date DATE NOT NULL,
  program_name TEXT NOT NULL,
  instructor TEXT NOT NULL,
  studio TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance_history(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_history(lesson_date);

-- プラン情報テーブル
CREATE TABLE IF NOT EXISTS membership_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,  -- 例: "マンスリー15"
  monthly_limit INTEGER NOT NULL,  -- 月間受講可能数
  current_month TEXT NOT NULL,  -- YYYY-MM形式
  used_count INTEGER DEFAULT 0,  -- 当月の受講数
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, current_month)
);

-- Row Level Security (RLS) の有効化
ALTER TABLE feelcycle_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

-- RLSポリシー: ユーザーは自分のデータのみアクセス可能
CREATE POLICY "Users can view their own credentials"
  ON feelcycle_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own credentials"
  ON feelcycle_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credentials"
  ON feelcycle_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own waitlist"
  ON waitlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own waitlist"
  ON waitlist FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own attendance"
  ON attendance_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own plan"
  ON membership_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own plan"
  ON membership_plans FOR ALL
  USING (auth.uid() = user_id);

-- レッスン情報は全ユーザーが閲覧可能
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view lessons"
  ON lessons FOR SELECT
  TO authenticated
  USING (true);

-- 関数: updated_atを自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガー: updated_at自動更新
CREATE TRIGGER update_feelcycle_credentials_updated_at BEFORE UPDATE
  ON feelcycle_credentials FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE
  ON lessons FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_waitlist_updated_at BEFORE UPDATE
  ON waitlist FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_membership_plans_updated_at BEFORE UPDATE
  ON membership_plans FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
