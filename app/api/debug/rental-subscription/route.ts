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

  // 1. JSバンドルから$ROUTES定義のrentalセクションを探す
  try {
    const res = await fetch(`${BASE_URL}/js/app.js?id=2d37bb4f92f769de4c57`, {
      headers: { 'User-Agent': headers['User-Agent'] },
    });
    const js = await res.text();

    // POST_RENTAL 関連のルート定義を探す
    const rentalRouteMatches = js.match(/.{0,60}POST_RENTAL[^,}]{0,120}/gi) || [];
    // GET_RENTAL も探す
    const getRentalMatches = js.match(/.{0,60}GET_RENTAL[^,}]{0,120}/gi) || [];
    // RENTAL を含むURL定義を探す（"/api/..."形式）
    const rentalApiUrls = js.match(/.{0,30}\/api\/[^"'`\s]*rental[^"'`\s]*.{0,30}/gi) || [];
    // $ROUTES や ROUTES オブジェクト定義付近
    const routesDef = js.match(/.{0,40}ROUTES\s*[=:{].{0,200}/gi) || [];
    // rental_item 関連
    const rentalItemMatches = js.match(/.{0,60}rental_item[^,;)]{0,120}/gi) || [];
    // mypage関連のAPIパスを全て探す
    const mypageApiMatches = js.match(/["'`]\/api\/[^"'`]*mypage[^"'`]*["'`]/gi) || [];
    // selling_rental 関連
    const sellingRentalMatches = js.match(/.{0,40}selling_rental.{0,80}/gi) || [];

    results.jsAnalysis = {
      rentalRouteMatches: [...new Set(rentalRouteMatches)].slice(0, 15),
      getRentalMatches: [...new Set(getRentalMatches)].slice(0, 15),
      rentalApiUrls: [...new Set(rentalApiUrls)].slice(0, 15),
      routesDef: [...new Set(routesDef)].slice(0, 10),
      rentalItemMatches: [...new Set(rentalItemMatches)].slice(0, 15),
      mypageApiMatches: [...new Set(mypageApiMatches)],
      sellingRentalMatches: [...new Set(sellingRentalMatches)].slice(0, 10),
    };
  } catch (e) {
    results.jsAnalysis = { error: String(e) };
  }

  // 2. 推測されるエンドポイントを試す
  const guessEndpoints = [
    { url: `${BASE_URL}/api/user/mypage/rental`, method: 'POST' },
    { url: `${BASE_URL}/api/auth/user/rental`, method: 'POST' },
    { url: `${BASE_URL}/api/auth/user/rental_item`, method: 'POST' },
    { url: `${BASE_URL}/api/rental/list`, method: 'POST' },
    { url: `${BASE_URL}/api/rental_item/list`, method: 'POST' },
    { url: `${BASE_URL}/api/user/rental_item`, method: 'POST' },
    { url: `${BASE_URL}/api/mypage/rental`, method: 'POST' },
    { url: `${BASE_URL}/api/rental_subscription`, method: 'POST' },
  ];

  const apiResults: Record<string, unknown>[] = [];
  for (const ep of guessEndpoints) {
    try {
      const res = await fetch(ep.url, { method: ep.method, headers });
      let body: unknown;
      const text = await res.text();
      try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
      apiResults.push({ endpoint: `${ep.method} ${ep.url}`, status: res.status, body });
    } catch (e) {
      apiResults.push({ endpoint: `${ep.method} ${ep.url}`, error: String(e) });
    }
  }
  results.apiProbes = apiResults;

  return NextResponse.json(results);
}
