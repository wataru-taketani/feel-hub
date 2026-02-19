import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ presets: [] });
  }

  const { data, error } = await supabase
    .from('filter_presets')
    .select('id, name, is_default, filters')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const presets = (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    isDefault: row.is_default,
    filters: row.filters,
  }));

  return NextResponse.json({ presets });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const body = await request.json();
  const { action, preset, id, filters, name, isDefault } = body;

  switch (action) {
    case 'save': {
      if (!preset) return NextResponse.json({ error: 'preset required' }, { status: 400 });
      const { error } = await supabase.from('filter_presets').upsert({
        id: preset.id,
        user_id: user.id,
        name: preset.name,
        is_default: preset.isDefault || false,
        filters: preset.filters,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    case 'update': {
      if (!id || !filters) return NextResponse.json({ error: 'id and filters required' }, { status: 400 });
      const { error } = await supabase.from('filter_presets')
        .update({ filters })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    case 'rename': {
      if (!id || !name) return NextResponse.json({ error: 'id and name required' }, { status: 400 });
      const { error } = await supabase.from('filter_presets')
        .update({ name })
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    case 'setDefault': {
      // 全件 false → 対象 true
      await supabase.from('filter_presets')
        .update({ is_default: false })
        .eq('user_id', user.id);
      if (id) {
        await supabase.from('filter_presets')
          .update({ is_default: true })
          .eq('id', id)
          .eq('user_id', user.id);
      }
      return NextResponse.json({ success: true });
    }

    case 'delete': {
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
      const { error } = await supabase.from('filter_presets')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    case 'migrate': {
      // localStorage → Supabase 一括移行
      const presets = body.presets;
      if (!Array.isArray(presets)) return NextResponse.json({ error: 'presets required' }, { status: 400 });
      const rows = presets.map((p: { id: string; name: string; isDefault?: boolean; filters: unknown }) => ({
        id: p.id,
        user_id: user.id,
        name: p.name,
        is_default: p.isDefault || false,
        filters: p.filters,
      }));
      const { error } = await supabase.from('filter_presets').upsert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // 移行後のデータを返す
      const { data } = await supabase.from('filter_presets')
        .select('id, name, is_default, filters')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      const merged = (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        isDefault: row.is_default,
        filters: row.filters,
      }));
      return NextResponse.json({ success: true, presets: merged });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
