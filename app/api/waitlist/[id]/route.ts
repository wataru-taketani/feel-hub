import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // auto_reserve の切り替え or notified の再開
  const updates: Record<string, unknown> = {};
  if (typeof body.autoReserve === 'boolean') {
    updates.auto_reserve = body.autoReserve;
  }
  if (typeof body.notified === 'boolean') {
    updates.notified = body.notified;
  }
  // 後方互換: bodyが空の場合は従来の「再開」動作
  if (Object.keys(updates).length === 0) {
    updates.notified = false;
  }

  const { error } = await supabase
    .from('waitlist')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { id } = await params;

  const { error } = await supabase
    .from('waitlist')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
