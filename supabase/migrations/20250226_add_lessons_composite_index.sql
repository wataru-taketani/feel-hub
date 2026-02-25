-- lessons テーブルの検索パフォーマンス改善
-- studio + date + time の複合インデックス（API の主要クエリパターンに対応）
CREATE INDEX IF NOT EXISTS idx_lessons_studio_date_time
ON lessons(studio, date, time);

-- program_name + date のインデックス（/api/lessons/count クエリに対応）
CREATE INDEX IF NOT EXISTS idx_lessons_program_date
ON lessons(program_name, date);
