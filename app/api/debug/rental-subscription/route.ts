import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/crypto';
import type { FeelcycleSession } from '@/lib/feelcycle-api';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_URL = 'https://m.feelcycle.com';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not auth' }, { status: 401 });

  const { data: sessionRow } = await supabaseAdmin
    .from('feelcycle_sessions')
    .select('session_encrypted, expires_at')
    .eq('user_id', user.id)
    .single();

  if (!sessionRow || new Date(sessionRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'no fc session or expired' }, { status: 400 });
  }

  let session: FeelcycleSession;
  try {
    session = JSON.parse(decrypt(sessionRow.session_encrypted));
  } catch {
    return NextResponse.json({ error: 'decrypt failed' }, { status: 500 });
  }

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
    'X-Requested-With': 'XMLHttpRequest',
    'X-XSRF-TOKEN': session.xsrfToken,
    'X-CSRF-TOKEN': session.csrfToken,
    'Cookie': `XSRF-TOKEN=${encodeURIComponent(session.xsrfToken)}; laravel_session=${session.laravelSession}`,
    'Accept': 'application/json',
    'Referer': `${BASE_URL}/mypage/rental-subscription`,
  };

  const results: Record<string, unknown> = {};

  // 1. /api/user/mypage の生レスポンス全体をダンプ（レンタル関連フィールド探索）
  try {
    const res = await fetch(`${BASE_URL}/api/user/mypage`, { method: 'POST', headers });
    const body = await res.json();
    // reservation_status は大きいので除外
    const { reservation_status, ...rest } = body;
    results.mypageRaw = {
      status: res.status,
      keys: Object.keys(body),
      data: rest,
      reservationCount: Array.isArray(reservation_status) ? reservation_status.length : 0,
    };
  } catch (e) {
    results.mypageRaw = { error: String(e) };
  }

  // 2. /mypage/rental-subscription のHTMLページを取得してAPI呼び出しを特定
  try {
    const htmlHeaders = { ...headers, Accept: 'text/html' };
    const res = await fetch(`${BASE_URL}/mypage/rental-subscription`, { headers: htmlHeaders });
    const html = await res.text();
    // APIエンドポイントっぽいURLを抽出
    const apiMatches = html.match(/["']\/api\/[^"']+["']/g) || [];
    // axiosやfetch呼び出しパターンを抽出
    const fetchMatches = html.match(/(?:axios|fetch|post|get)\s*\(\s*["'][^"']+["']/gi) || [];
    results.htmlPage = {
      status: res.status,
      length: html.length,
      apiEndpoints: [...new Set(apiMatches)],
      fetchCalls: [...new Set(fetchMatches)],
      // rental関連のテキスト抽出
      rentalSnippets: html.match(/.{0,80}rental.{0,80}/gi) || [],
      subscriptionSnippets: html.match(/.{0,80}subscription.{0,80}/gi) || [],
    };
  } catch (e) {
    results.htmlPage = { error: String(e) };
  }

  return NextResponse.json(results);
}
