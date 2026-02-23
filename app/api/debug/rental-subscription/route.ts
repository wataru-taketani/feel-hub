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
    'Accept': 'text/html',
    'Referer': `${BASE_URL}/mypage`,
  };

  const results: Record<string, unknown> = {};

  // 1. /mypage/rental-subscription のHTML全文を取得
  try {
    const res = await fetch(`${BASE_URL}/mypage/rental-subscription`, { headers });
    const html = await res.text();
    results.html = html;

    // scriptタグのsrc属性を抽出
    const scriptSrcs = html.match(/src="([^"]+\.js[^"]*)"/g) || [];
    results.scripts = scriptSrcs;
  } catch (e) {
    results.html = { error: String(e) };
  }

  // 2. JSバンドルの中からAPIエンドポイントを探す
  const scriptUrls: string[] = [];
  const htmlStr = results.html as string;
  if (typeof htmlStr === 'string') {
    const matches = htmlStr.matchAll(/src="([^"]+\.js[^"]*)"/g);
    for (const m of matches) {
      let url = m[1];
      if (url.startsWith('/')) url = BASE_URL + url;
      scriptUrls.push(url);
    }
  }

  // 各JSバンドルから rental/subscription 関連のコードを探す
  const jsFindings: Record<string, unknown>[] = [];
  for (const url of scriptUrls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': headers['User-Agent'] } });
      const js = await res.text();
      // rental/subscription関連の文字列を探す
      const rentalMatches = js.match(/.{0,100}rental.{0,100}/gi) || [];
      const subscMatches = js.match(/.{0,100}subscription.{0,100}/gi) || [];
      const apiMatches = js.match(/.{0,100}\/api\/[^\s"'`]{3,60}.{0,30}/gi) || [];
      if (rentalMatches.length > 0 || subscMatches.length > 0) {
        jsFindings.push({
          url,
          size: js.length,
          rentalMatches: rentalMatches.slice(0, 20),
          subscMatches: subscMatches.slice(0, 20),
          apiMatches: apiMatches.slice(0, 30),
        });
      }
    } catch (e) {
      jsFindings.push({ url, error: String(e) });
    }
  }
  results.jsFindings = jsFindings;

  return NextResponse.json(results);
}
