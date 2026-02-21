import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/groups/[id]/leave — グループ退出
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  // 作成者かどうかチェック
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', id)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'グループに参加していません' }, { status: 400 });
  }

  if (membership.role === 'creator') {
    return NextResponse.json(
      { error: '作成者はグループを退出できません。グループを削除してください。' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: '退出に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
