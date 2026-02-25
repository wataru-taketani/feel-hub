CREATE INDEX IF NOT EXISTS idx_attendance_user_cancel_date
ON attendance_history(user_id, cancel_flg, shift_date);
