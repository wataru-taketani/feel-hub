import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/groups/[id]/invite-lesson — グループメンバーにレッスンお誘い通知
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  // 自分がグループメンバーであることを確認
  const { data: membership } = await supabaseAdmin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'グループに所属していません' }, { status: 403 });
  }

  const body = await request.json();
  const { programName, date, startTime, endTime, instructor, studio } = body;

  if (!programName || !date || !startTime || !endTime || !instructor || !studio) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
  }

  // 送信者の表示名を取得
  const { data: senderProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('display_name, line_display_name')
    .eq('id', user.id)
    .single();

  const senderName = senderProfile?.display_name || senderProfile?.line_display_name || '仲間';

  // 自分以外のグループメンバーを取得
  const { data: members } = await supabaseAdmin
    .from('group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .neq('user_id', user.id);

  if (!members || members.length === 0) {
    return NextResponse.json({ sent: 0, total: 0 });
  }

  // メンバーのLINE user IDを取得
  const memberIds = members.map((m) => m.user_id);
  const { data: profiles } = await supabaseAdmin
    .from('user_profiles')
    .select('id, line_user_id')
    .in('id', memberIds);

  const lineUserIds = (profiles || [])
    .map((p) => p.line_user_id)
    .filter((id): id is string => !!id);

  const total = members.length;

  if (lineUserIds.length === 0) {
    return NextResponse.json({ sent: 0, total });
  }

  // 曜日計算
  const d = new Date(date);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;

  const message = `【レッスンお誘い】\n${senderName}さんが予約しました！\n\n${programName}\n${dateStr} ${startTime}〜${endTime}\n${instructor}\n${studio}\n\nhttps://m.feelcycle.com/reserve`;

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'LINE設定エラー' }, { status: 500 });
  }

  // 各メンバーにpush通知
  let sent = 0;
  for (const lineUserId of lineUserIds) {
    try {
      const res = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: lineUserId,
          messages: [{ type: 'text', text: message }],
        }),
      });

      if (res.ok) {
        sent++;
      } else {
        const errBody = await res.text();
        console.error(`LINE push failed for ${lineUserId}: ${res.status} ${errBody}`);
      }
    } catch (error) {
      console.error(`LINE push error for ${lineUserId}:`, error);
    }
  }

  return NextResponse.json({ sent, total });
}
