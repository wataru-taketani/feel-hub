import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/crypto';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_URL = 'https://m.feelcycle.com';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not auth' }, { status: 401 });

  // FCセッション取得
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('fc_session_data')
    .eq('id', user.id)
    .single();

  if (!profile?.fc_session_data) {
    return NextResponse.json({ error: 'no fc session' }, { status: 400 });
  }

  const session = profile.fc_session_data as { laravelSession: string; xsrfToken: string; csrfToken: string };

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
