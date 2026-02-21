-- Fix infinite recursion in group_members RLS policy
-- The SELECT policy was referencing group_members itself, causing recursion.
-- Solution: use a SECURITY DEFINER function to bypass RLS for the membership check.

CREATE OR REPLACE FUNCTION is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

-- Recreate group_members SELECT policy
DROP POLICY "group_members_select" ON group_members;
CREATE POLICY "group_members_select" ON group_members
  FOR SELECT USING (is_group_member(group_id, auth.uid()));

-- Also fix groups SELECT policy (it queries group_members too)
DROP POLICY "groups_select_member" ON groups;
CREATE POLICY "groups_select_member" ON groups
  FOR SELECT USING (is_group_member(id, auth.uid()));
