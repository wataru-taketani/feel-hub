import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/groups/invite/[code] — 招待プレビュー
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  // 非メンバーがアクセスするためsupabaseAdminでグループ検索
  const { data: group, error: grpError } = await supabaseAdmin
    .from('groups')
    .select('id, name, created_by')
    .eq('invite_code', code)
    .single();

  if (grpError || !group) {
    return NextResponse.json({ error: '招待リンクが無効です' }, { status: 404 });
  }

  // メンバー数を取得
  const { count } = await supabaseAdmin
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', group.id);

  // 作成者名を取得
  const { data: creatorProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('display_name, line_display_name')
    .eq('id', group.created_by)
    .single();

  const creatorName = creatorProfile?.display_name || creatorProfile?.line_display_name || '不明';

  // 参加済みかチェック
  const { data: existing } = await supabaseAdmin
    .from('group_members')
    .select('user_id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({
    groupId: group.id,
    groupName: group.name,
    memberCount: count || 0,
    creatorName,
    alreadyJoined: !!existing,
  });
}

// POST /api/groups/invite/[code] — 招待受諾
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  // supabaseAdminでグループ検索（非メンバーがアクセスするため）
  const { data: group, error: grpError } = await supabaseAdmin
    .from('groups')
    .select('id')
    .eq('invite_code', code)
    .single();

  if (grpError || !group) {
    return NextResponse.json({ error: '招待リンクが無効です' }, { status: 404 });
  }

  // メンバー上限チェック
  const { count } = await supabaseAdmin
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', group.id);

  if ((count || 0) >= 20) {
    return NextResponse.json({ error: 'グループのメンバー数が上限（20人）に達しています' }, { status: 400 });
  }

  // upsertで冪等にメンバー追加
  const { error: insertError } = await supabase
    .from('group_members')
    .upsert(
      {
        group_id: group.id,
        user_id: user.id,
        role: 'member',
      },
      { onConflict: 'group_id,user_id' }
    );

  if (insertError) {
    return NextResponse.json({ error: '参加に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ groupId: group.id });
}
