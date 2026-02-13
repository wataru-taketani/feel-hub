import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: data ? {
      id: data.id,
      displayName: data.display_name,
      homeStore: data.home_store,
      membershipType: data.membership_type,
      joinedAt: data.joined_at,
      lineUserId: data.line_user_id || null,
    } : null,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.joinedAt !== undefined) updates.joined_at = body.joinedAt;
  if (body.displayName !== undefined) updates.display_name = body.displayName;
  if (body.homeStore !== undefined) updates.home_store = body.homeStore;
  if (body.lineUserId !== undefined) updates.line_user_id = body.lineUserId;

  const { error } = await supabase
    .from('user_profiles')
    .upsert({ id: user.id, ...updates });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
