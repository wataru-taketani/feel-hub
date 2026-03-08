-- attendance_history の program_name 別受講回数を DB 側で集計する RPC
CREATE OR REPLACE FUNCTION get_program_counts(p_user_id UUID)
RETURNS TABLE(program_name TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ah.program_name, COUNT(*) AS count
  FROM attendance_history ah
  WHERE ah.user_id = p_user_id
    AND ah.cancel_flg = 0
  GROUP BY ah.program_name;
$$;
