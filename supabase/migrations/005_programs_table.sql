CREATE TABLE programs (
  program_name TEXT PRIMARY KEY,
  color_code TEXT NOT NULL DEFAULT '#6B7280',
  text_color TEXT NOT NULL DEFAULT '#FFFFFF',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 全員が読める（色情報は公開データ）
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view programs" ON programs FOR SELECT TO authenticated USING (true);

-- 既存 lessons データから初期投入
INSERT INTO programs (program_name, color_code, text_color)
SELECT DISTINCT ON (program_name) program_name, color_code, text_color
FROM lessons
WHERE color_code IS NOT NULL AND color_code != ''
ON CONFLICT DO NOTHING;
