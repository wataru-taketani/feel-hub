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

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'not auth' }, { status: 401 });

  // クエリパラメータでユーザーID指定可能（デバッグ用）
  const url = new URL(request.url);
  const targetUserId = url.searchParams.get('uid') || user.id;

  const { data: sessionRow } = await supabaseAdmin
    .from('feelcycle_sessions')
    .select('session_encrypted, expires_at')
    .eq('user_id', targetUserId)
    .single();

  if (!sessionRow) {
    return NextResponse.json({ error: 'no fc session for user ' + targetUserId }, { status: 400 });
  }
  if (new Date(sessionRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'fc session expired for user ' + targetUserId }, { status: 400 });
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

  // POST /api/rental_item/select（空payload = 初期データロード）
  try {
    const res = await fetch(`${BASE_URL}/api/rental_item/select`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    const body = await res.json();
    return NextResponse.json({ targetUserId, status: res.status, body });
  } catch (e) {
    return NextResponse.json({ targetUserId, error: String(e) }, { status: 500 });
  }
}
