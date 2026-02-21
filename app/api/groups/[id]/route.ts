import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/groups/[id] — グループ詳細 + メンバー一覧
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  // RLSでメンバーのみ取得可能
  const { data: group, error: grpError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', id)
    .single();

  if (grpError || !group) {
    return NextResponse.json({ error: 'グループが見つかりません' }, { status: 404 });
  }

  // メンバー一覧取得
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, role, joined_at')
    .eq('group_id', id)
    .order('joined_at', { ascending: true });

  // メンバーのプロフィール情報をservice_roleで取得（user_profilesのRLSは自分のみ）
  const memberUserIds = (members || []).map((m) => m.user_id);
  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('id, display_name, line_display_name, line_picture_url')
    .in('id', memberUserIds);

  const profileMap = Object.fromEntries(
    (profiles || []).map((p) => [p.id, p])
  );

  const memberList = (members || []).map((m) => {
    const profile = profileMap[m.user_id];
    return {
      userId: m.user_id,
      displayName: profile?.display_name || profile?.line_display_name || null,
      linePictureUrl: profile?.line_picture_url || null,
      role: m.role,
      joinedAt: m.joined_at,
    };
  });

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      createdBy: group.created_by,
      inviteCode: group.invite_code,
      memberCount: memberList.length,
      isCreator: group.created_by === user.id,
      createdAt: group.created_at,
    },
    members: memberList,
  });
}

// DELETE /api/groups/[id] — グループ削除（作成者のみ、RLSで制御）
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'グループの削除に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
