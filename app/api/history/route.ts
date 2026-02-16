import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // YYYY-MM
  const from = searchParams.get('from');   // YYYY-MM-DD
  const to = searchParams.get('to');       // YYYY-MM-DD
  const program = searchParams.get('program'); // exact match

  let query = supabaseAdmin
    .from('attendance_history')
    .select('*')
    .eq('user_id', user.id)
    .eq('cancel_flg', 0)
    .order('shift_date', { ascending: false })
    .order('start_time', { ascending: false });

  if (month) {
    const startDate = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const endDate = new Date(y, m, 0); // 月末
    const endStr = `${y}-${String(m).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    query = query.gte('shift_date', startDate).lte('shift_date', endStr);
  }

  if (from) query = query.gte('shift_date', from);
  if (to) query = query.lte('shift_date', to);
  if (program) query = query.eq('program_name', program);

  const { data, error } = await query;

  if (error) {
    console.error('[history] query error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const records = (data || []).map((r) => ({
    id: r.id,
    shiftDate: r.shift_date,
    startTime: r.start_time,
    endTime: r.end_time,
    storeName: r.store_name,
    instructorName: r.instructor_name,
    programName: r.program_name,
    sheetNo: r.sheet_no,
    ticketName: r.ticket_name,
    playlistUrl: r.playlist_url,
    cancelFlg: r.cancel_flg,
  }));

  return NextResponse.json({ records });
}
