-- グループ機能 Phase 1

-- groups テーブル
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- group_members テーブル
CREATE TABLE group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('creator', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- インデックス
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_groups_invite_code ON groups(invite_code);

-- RLS 有効化
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- groups RLS ポリシー
-- メンバーのみ閲覧可
CREATE POLICY "groups_select_member" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
        AND group_members.user_id = auth.uid()
    )
  );

-- 認証ユーザーは作成可
CREATE POLICY "groups_insert_auth" ON groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 作成者のみ更新可
CREATE POLICY "groups_update_creator" ON groups
  FOR UPDATE USING (auth.uid() = created_by);

-- 作成者のみ削除可
CREATE POLICY "groups_delete_creator" ON groups
  FOR DELETE USING (auth.uid() = created_by);

-- group_members RLS ポリシー
-- メンバーは同じグループのメンバー一覧を閲覧可
CREATE POLICY "group_members_select" ON group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members AS gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
    )
  );

-- 自分自身をメンバーとして追加可
CREATE POLICY "group_members_insert_self" ON group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 自分自身のメンバーシップを削除可
CREATE POLICY "group_members_delete_self" ON group_members
  FOR DELETE USING (auth.uid() = user_id);
