import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ preset: null });
  }

  const { data, error } = await supabase
    .from('filter_presets')
    .select('id, filters')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = data?.[0];
  const preset = row ? { id: row.id, filters: row.filters } : null;

  return NextResponse.json({ preset });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const body = await request.json();
  const { filters } = body;

  if (!filters) {
    return NextResponse.json({ error: 'filters required' }, { status: 400 });
  }

  // 既存行を取得（最新1行）
  const { data: existing } = await supabase
    .from('filter_presets')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (existing && existing.length > 0) {
    // 最新1行を更新
    const { error } = await supabase
      .from('filter_presets')
      .update({ filters, name: '', is_default: true })
      .eq('id', existing[0].id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 古い行をクリーンアップ
    if (existing.length > 1) {
      const oldIds = existing.slice(1).map((r) => r.id);
      await supabase.from('filter_presets').delete().in('id', oldIds);
    }
  } else {
    // 新規挿入
    const { error } = await supabase.from('filter_presets').insert({
      user_id: user.id,
      name: '',
      is_default: true,
      filters,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
