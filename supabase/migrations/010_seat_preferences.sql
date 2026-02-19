-- お気に入り席テーブル
CREATE TABLE IF NOT EXISTS seat_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio TEXT NOT NULL,
  seat_numbers TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, studio)
);
ALTER TABLE seat_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own seat preferences"
  ON seat_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
