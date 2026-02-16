-- Migration: レッスンのユニーク制約を sid_hash に変更
--
-- 問題: UNIQUE(date, time, studio, instructor) だとIR変更時に旧行が残り重複する
-- 修正: sid_hash（FEELCYCLE APIのタイムスロット固有ID）をユニークキーにする
--
-- 実行方法: Supabase ダッシュボード > SQL Editor で実行

BEGIN;

-- Step 1: 重複 sid_hash の waitlist 参照を最新行に移行
-- (同一ユーザーが重複行の両方にwaitlist登録している場合は、古い方を削除)
WITH latest AS (
  SELECT DISTINCT ON (sid_hash) id, sid_hash
  FROM lessons
  WHERE sid_hash IS NOT NULL
  ORDER BY sid_hash, updated_at DESC
),
stale AS (
  SELECT l.id AS old_id, lat.id AS new_id
  FROM lessons l
  JOIN latest lat ON l.sid_hash = lat.sid_hash
  WHERE l.id != lat.id
  AND l.sid_hash IS NOT NULL
)
-- まず、移行先に同一ユーザーの登録がある場合は古い方を削除
DELETE FROM waitlist
WHERE id IN (
  SELECT w_stale.id
  FROM waitlist w_stale
  JOIN stale s ON w_stale.lesson_id = s.old_id
  JOIN waitlist w_new ON w_new.user_id = w_stale.user_id AND w_new.lesson_id = s.new_id
);

-- 残りの waitlist 参照を最新行に移行
WITH latest AS (
  SELECT DISTINCT ON (sid_hash) id, sid_hash
  FROM lessons
  WHERE sid_hash IS NOT NULL
  ORDER BY sid_hash, updated_at DESC
),
stale AS (
  SELECT l.id AS old_id, lat.id AS new_id
  FROM lessons l
  JOIN latest lat ON l.sid_hash = lat.sid_hash
  WHERE l.id != lat.id
  AND l.sid_hash IS NOT NULL
)
UPDATE waitlist w
SET lesson_id = s.new_id
FROM stale s
WHERE w.lesson_id = s.old_id;

-- Step 2: 重複行を削除（sid_hash ごとに最新の1行のみ残す）
DELETE FROM lessons
WHERE id IN (
  SELECT l.id
  FROM lessons l
  JOIN (
    SELECT DISTINCT ON (sid_hash) id AS keep_id, sid_hash
    FROM lessons
    WHERE sid_hash IS NOT NULL
    ORDER BY sid_hash, updated_at DESC
  ) latest ON l.sid_hash = latest.sid_hash
  WHERE l.id != latest.keep_id
  AND l.sid_hash IS NOT NULL
);

-- Step 3: sid_hash が NULL の古いレッスン行をクリーンアップ
DELETE FROM lessons WHERE sid_hash IS NULL;

-- Step 4: sid_hash に NOT NULL 制約を追加
ALTER TABLE lessons ALTER COLUMN sid_hash SET NOT NULL;

-- Step 5: 旧ユニーク制約を削除
ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_date_time_studio_instructor_key;

-- Step 6: sid_hash にユニーク制約を追加
ALTER TABLE lessons ADD CONSTRAINT lessons_sid_hash_key UNIQUE (sid_hash);

COMMIT;
