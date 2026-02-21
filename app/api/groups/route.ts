import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { generateInviteCode } from '@/lib/invite-code';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/groups — 自分のグループ一覧
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  // 自分が参加しているグループ一覧を取得
  const { data: memberships, error: memError } = await supabaseAdmin
    .from('group_members')
    .select('group_id, role')
    .eq('user_id', user.id);

  if (memError) {
    return NextResponse.json({ error: memError.message }, { status: 500 });
  }

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  const groupIds = memberships.map((m) => m.group_id);
  const roleMap = Object.fromEntries(memberships.map((m) => [m.group_id, m.role]));

  // グループ情報を取得
  const { data: groups, error: grpError } = await supabaseAdmin
    .from('groups')
    .select('*')
    .in('id', groupIds)
    .order('created_at', { ascending: false });

  if (grpError) {
    return NextResponse.json({ error: grpError.message }, { status: 500 });
  }

  // メンバー数を取得
  const { data: counts } = await supabaseAdmin
    .from('group_members')
    .select('group_id')
    .in('group_id', groupIds);

  const countMap: Record<string, number> = {};
  for (const row of counts || []) {
    countMap[row.group_id] = (countMap[row.group_id] || 0) + 1;
  }

  return NextResponse.json({
    groups: (groups || []).map((g) => ({
      id: g.id,
      name: g.name,
      createdBy: g.created_by,
      inviteCode: g.invite_code,
      memberCount: countMap[g.id] || 0,
      isCreator: roleMap[g.id] === 'creator',
      createdAt: g.created_at,
    })),
  });
}

// POST /api/groups — グループ作成
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const body = await request.json();
  const name = (body.name || '').trim();

  if (!name) {
    return NextResponse.json({ error: 'グループ名は必須です' }, { status: 400 });
  }
  if (name.length > 50) {
    return NextResponse.json({ error: 'グループ名は50文字以内にしてください' }, { status: 400 });
  }

  const inviteCode = generateInviteCode();

  // グループ作成
  const { data: group, error: createError } = await supabaseAdmin
    .from('groups')
    .insert({
      name,
      created_by: user.id,
      invite_code: inviteCode,
    })
    .select()
    .single();

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // 作成者をメンバーに追加
  const { error: memberError } = await supabaseAdmin
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: 'creator',
    });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      createdBy: group.created_by,
      inviteCode: group.invite_code,
      memberCount: 1,
      isCreator: true,
      createdAt: group.created_at,
    },
  });
}
