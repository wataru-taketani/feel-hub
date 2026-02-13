import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { getLessonHistory } from '@/lib/feelcycle-api';
import { upsertHistory } from '@/lib/history-sync';
import type { FeelcycleSession } from '@/lib/feelcycle-api';

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  // FEELCYCLEセッション取得
  const { data: sessionRow } = await supabaseAdmin
    .from('feelcycle_sessions')
    .select('session_encrypted, expires_at')
    .eq('user_id', user.id)
    .single();

  if (!sessionRow || new Date(sessionRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'セッション期限切れ。再ログインしてください。' }, { status: 401 });
  }

  let fcSession: FeelcycleSession;
  try {
    fcSession = JSON.parse(decrypt(sessionRow.session_encrypted));
  } catch {
    return NextResponse.json({ error: 'セッション復号失敗' }, { status: 500 });
  }

  // 開始月を決定（joined_atまたは2年前）
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('joined_at')
    .eq('id', user.id)
    .single();

  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let startDate: Date;
  if (profile?.joined_at) {
    startDate = new Date(profile.joined_at);
  } else {
    startDate = new Date(now.getFullYear() - 2, now.getMonth(), 1);
  }

  // 取得済み月を確認
  const { data: fetched } = await supabaseAdmin
    .from('attendance_history')
    .select('fetched_month')
    .eq('user_id', user.id);

  const fetchedMonths = new Set((fetched || []).map((r) => r.fetched_month));

  // 未取得月のリストを作成
  const monthsToFetch: string[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (cursor <= now) {
    const ym = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    // 当月は常に再取得（最新データのため）
    if (!fetchedMonths.has(ym) || ym === currentYm) {
      monthsToFetch.push(ym);
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // 月ごとにFEELCYCLE APIから取得してUPSERT
  let totalSynced = 0;
  const errors: string[] = [];

  for (const ym of monthsToFetch) {
    try {
      const records = await getLessonHistory(fcSession, ym);
      const result = await upsertHistory(supabaseAdmin, user.id, records, ym);

      if (result.error) {
        errors.push(`${ym}: ${result.error}`);
      } else {
        totalSynced += result.synced;
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
        return NextResponse.json({ error: 'セッション期限切れ。再ログインしてください。' }, { status: 401 });
      }
      errors.push(`${ym}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }

  return NextResponse.json({
    synced: totalSynced,
    monthsFetched: monthsToFetch.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
