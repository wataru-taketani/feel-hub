import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_URL = 'https://m.feelcycle.com';

// 一時デバッグ用: 受講履歴APIの生レスポンスフィールドを返す
export async function GET() {
  const userId = 'd3fa0f31-d102-49ab-a4b2-5927233be467';

  const { data: sessionRow } = await supabaseAdmin
    .from('feelcycle_sessions')
    .select('session_encrypted')
    .eq('user_id', userId)
    .single();

  if (!sessionRow) {
    return NextResponse.json({ error: 'no session' }, { status: 404 });
  }

  const session = JSON.parse(decrypt(sessionRow.session_encrypted));

  const ym = new Date().toISOString().slice(0, 7).replace('-', '');

  const res = await fetch(`${BASE_URL}/api/auth/user/lesson_hist`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': session.xsrfToken,
      'X-CSRF-TOKEN': session.csrfToken,
      Cookie: `laravel_session=${session.laravelSession}; XSRF-TOKEN=${encodeURIComponent(session.xsrfToken)}`,
    },
    body: JSON.stringify({ target_ym: ym }),
  });

  const data = await res.json();
  const monthData = data[ym] as Record<string, unknown> | undefined;
  const list = (monthData?.lesson_info || []) as Record<string, unknown>[];

  if (list.length === 0) {
    return NextResponse.json({ message: 'no records this month', rawKeys: Object.keys(data), ym });
  }

  // 最初の1件の全フィールドを返す
  return NextResponse.json({
    sampleRecord: list[0],
    allKeys: Object.keys(list[0]),
    totalRecords: list.length,
  });
}
