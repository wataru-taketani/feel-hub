-- instructor_ids: インストラクターIDを配列で保存（同名インストラクター区別用）
ALTER TABLE attendance_history ADD COLUMN IF NOT EXISTS instructor_ids integer[];
