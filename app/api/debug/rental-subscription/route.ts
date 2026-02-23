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

  // FCセッション取得（feelcycle_sessionsテーブルから）
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

  // Try multiple possible endpoints
  const endpoints = [
    { url: `${BASE_URL}/api/user/mypage/rental-subscription`, method: 'POST' },
    { url: `${BASE_URL}/api/user/mypage/rental-subscription`, method: 'GET' },
    { url: `${BASE_URL}/api/user/rental-subscription`, method: 'POST' },
    { url: `${BASE_URL}/api/user/rental-subscription`, method: 'GET' },
    { url: `${BASE_URL}/api/rental-subscription`, method: 'POST' },
    { url: `${BASE_URL}/api/rental-subscription`, method: 'GET' },
  ];

  const results: Record<string, unknown>[] = [];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, { method: ep.method, headers });
      let body: unknown;
      const text = await res.text();
      try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
      results.push({
        endpoint: `${ep.method} ${ep.url}`,
        status: res.status,
        body,
      });
    } catch (e) {
      results.push({
        endpoint: `${ep.method} ${ep.url}`,
        error: String(e),
      });
    }
  }

  return NextResponse.json({ results });
}
