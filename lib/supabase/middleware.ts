import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * ミドルウェア用のSupabaseクライアント
 *
 * 使用例: middleware.ts で使用
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // /groups/invite/* は未認証でもアクセス可（招待ページ）
  if (pathname.startsWith('/groups/invite')) {
    return NextResponse.next({ request });
  }

  // Supabase Auth Cookieが存在しない場合、getUser()をスキップして即座に返す
  // ボット/クローラーはCookieを持たないため、Supabaseへの無駄なHTTP通信を回避
  // チャンク分割対応: sb-xxx-auth-token または sb-xxx-auth-token.0 等にマッチ
  const hasAuthCookie = request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && /\-auth-token(\.\d+)?$/.test(c.name)
  );

  if (!hasAuthCookie) {
    // 認証必須APIへの未認証リクエスト → 即401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '未認証' }, { status: 401 });
    }
    // /login以外の全ページ → /loginにリダイレクト
    if (pathname !== '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  // --- 以下、Cookieあり（正規ユーザー）の場合のみ実行 ---
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // セッションの更新（重要: getUser()を呼び出してセッションを更新）
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // エラー発生時の分岐:
  // - 認証エラー（セッション期限切れ等）→ ログインにリダイレクト
  // - Supabase API障害（ネットワーク等）→ ログアウトさせずそのまま通す
  if (error && !user) {
    const isAuthError = error.status === 401 || error.status === 403
      || error.name === 'AuthSessionMissingError'
      || error.name === 'AuthApiError';
    if (!isAuthError) {
      // API障害 → Cookieがあるのでそのまま通す
      return supabaseResponse;
    }
    // 認証エラー → セッション切れとして処理（下のリダイレクト/401ロジックに進む）
  }

  if (!user && pathname.startsWith('/api/')) {
    // Cookieはあるがセッション切れ → 401（Cookieクリア込み）
    const res = NextResponse.json({ error: '未認証' }, { status: 401 });
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value);
    });
    return res;
  }

  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // ログイン済みで /login にアクセスした場合は / にリダイレクト
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
