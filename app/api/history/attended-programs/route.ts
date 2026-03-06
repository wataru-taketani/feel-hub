import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from('attendance_history')
    .select('program_name')
    .eq('user_id', user.id)
    .eq('cancel_flg', 0);

  if (error) {
    console.error('[attended-programs] query error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const programs = [...new Set((data || []).map(r => r.program_name))];
  return NextResponse.json({ programs });
}
