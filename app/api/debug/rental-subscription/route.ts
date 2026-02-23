import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/crypto';
import type { FeelcycleSession } from '@/lib/feelcycle-api';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_URL = 'https://m.feelcycle.com';

export async function GET(request: NextRequest) {
  const targetUserId = request.nextUrl.searchParams.get('uid');
  if (!targetUserId) {
    return NextResponse.json({ error: 'uid required' }, { status: 400 });
  }

  const { data: sessionRow } = await supabaseAdmin
    .from('feelcycle_sessions')
    .select('session_encrypted, expires_at')
    .eq('user_id', targetUserId)
    .single();

  if (!sessionRow) {
    return NextResponse.json({ error: 'no fc session' }, { status: 400 });
  }
  if (new Date(sessionRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'fc session expired' }, { status: 400 });
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
    'Content-Type': 'application/json',
    'Referer': `${BASE_URL}/mypage/rental-subscription`,
  };

  try {
    const res = await fetch(`${BASE_URL}/api/rental_item/select`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }

    if (res.status === 401 || res.status === 302 || res.status === 403) {
      // セッション切れ → 再認証を試みる
      const { data: creds } = await supabaseAdmin
        .from('feelcycle_credentials')
        .select('email_encrypted, password_encrypted')
        .eq('user_id', targetUserId)
        .single();

      if (!creds) {
        return NextResponse.json({ targetUserId, error: 'session expired, no credentials', fcStatus: res.status }, { status: 400 });
      }

      // 動的import で再認証
      const { login } = await import('@/lib/feelcycle-api');
      const email = decrypt(creds.email_encrypted);
      const password = decrypt(creds.password_encrypted);
      const newSession = await login(email, password);

      // 新セッション保存
      const { encrypt } = await import('@/lib/crypto');
      await supabaseAdmin
        .from('feelcycle_sessions')
        .upsert({
          user_id: targetUserId,
          session_encrypted: encrypt(JSON.stringify(newSession)),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        });

      // 再試行
      const retryHeaders = {
        ...headers,
        'X-XSRF-TOKEN': newSession.xsrfToken,
        'X-CSRF-TOKEN': newSession.csrfToken,
        'Cookie': `XSRF-TOKEN=${encodeURIComponent(newSession.xsrfToken)}; laravel_session=${newSession.laravelSession}`,
      };
      const res2 = await fetch(`${BASE_URL}/api/rental_item/select`, {
        method: 'POST',
        headers: retryHeaders,
        body: JSON.stringify({}),
      });
      const body2 = await res2.json();
      return NextResponse.json({ targetUserId, status: res2.status, body: body2, reauthed: true });
    }

    return NextResponse.json({ targetUserId, status: res.status, body });
  } catch (e) {
    return NextResponse.json({ targetUserId, error: String(e) }, { status: 500 });
  }
}
