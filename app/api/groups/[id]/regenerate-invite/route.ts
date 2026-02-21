import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateInviteCode } from '@/lib/invite-code';

// POST /api/groups/[id]/regenerate-invite — 招待コード再生成（作成者のみ）
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

  const newCode = generateInviteCode();

  // RLSで作成者のみ更新可能
  const { data, error } = await supabase
    .from('groups')
    .update({ invite_code: newCode, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('invite_code')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '招待コードの再生成に失敗しました' }, { status: 500 });
  }

  return NextResponse.json({ inviteCode: data.invite_code });
}
