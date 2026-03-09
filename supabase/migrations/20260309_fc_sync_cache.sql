-- FC同期キャッシュ用スキーマ変更

-- user_profiles に FC 会員情報キャッシュ列を追加
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS fc_member_name TEXT,
  ADD COLUMN IF NOT EXISTS fc_home_store TEXT,
  ADD COLUMN IF NOT EXISTS fc_plan_name TEXT,
  ADD COLUMN IF NOT EXISTS fc_monthly_fee INTEGER,
  ADD COLUMN IF NOT EXISTS fc_long_plan JSONB,
  ADD COLUMN IF NOT EXISTS fc_rental_info JSONB,
  ADD COLUMN IF NOT EXISTS fc_synced_at TIMESTAMPTZ;

-- 予約キャッシュテーブル
CREATE TABLE IF NOT EXISTS user_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  program_name TEXT NOT NULL,
  instructor TEXT NOT NULL,
  studio TEXT NOT NULL,
  sheet_no TEXT,
  cancel_wait_num TEXT,
  lesson_id UUID,
  sid_hash TEXT,
  ticket_name TEXT,
  bg_color TEXT,
  text_color TEXT,
  playlist_url TEXT,
  cancel_wait_total INTEGER DEFAULT 0,
  cancel_wait_position INTEGER DEFAULT 0,
  payment_method INTEGER DEFAULT 0,
  UNIQUE(user_id, date, start_time, studio)
);

-- チケットキャッシュテーブル
CREATE TABLE IF NOT EXISTS user_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_name TEXT NOT NULL,
  total_lot INTEGER,
  details JSONB,
  UNIQUE(user_id, ticket_name)
);

-- RLS ポリシー
ALTER TABLE user_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tickets ENABLE ROW LEVEL SECURITY;

-- service_role はフルアクセス（API Routes で使用）
CREATE POLICY "service_role_full_access" ON user_reservations
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON user_tickets
  FOR ALL USING (true) WITH CHECK (true);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_user_reservations_user_id ON user_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reservations_date ON user_reservations(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_tickets_user_id ON user_tickets(user_id);
