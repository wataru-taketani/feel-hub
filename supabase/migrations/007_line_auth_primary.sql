-- Phase 5-2: LINE Login を主認証に変更
-- feelcycle_credentials テーブル（FC認証情報の暗号化保存）

CREATE TABLE IF NOT EXISTS feelcycle_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_encrypted TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feelcycle_credentials ENABLE ROW LEVEL SECURITY;

-- user_profiles に LINE プロフィール列を追加
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS line_display_name TEXT,
  ADD COLUMN IF NOT EXISTS line_picture_url TEXT;

-- line_user_id のユニークインデックス（NULLは除外）
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_line_user_id
  ON user_profiles (line_user_id)
  WHERE line_user_id IS NOT NULL;
