import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const studio = request.nextUrl.searchParams.get('studio');
  if (!studio) {
    return NextResponse.json({ error: 'studio is required' }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from('lessons')
    .select('sid_hash')
    .eq('studio', studio)
    .not('sid_hash', 'is', null)
    .order('date', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ sidHash: data?.sid_hash ?? null });
}
