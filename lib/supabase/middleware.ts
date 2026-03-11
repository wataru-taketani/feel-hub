import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * ミドルウェア用のSupabaseクライアント
 *
 * 使用例: middleware.ts で使用
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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
  } = await supabase.auth.getUser();

  // 認証が必要なルートの保護
  const protectedPaths = ['/mypage', '/history', '/settings', '/groups'];
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  // /groups/invite/* は未認証でもアクセス可（招待ページ）
  const isInvitePage = request.nextUrl.pathname.startsWith('/groups/invite');
  if (isInvitePage) {
    return supabaseResponse;
  }

  // 認証必須APIへの未認証リクエストをEdgeで早期リターン（Serverless Function invocation削減）
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api/');
  const publicApiPrefixes = ['/api/auth/', '/api/lessons', '/api/studios', '/api/programs', '/api/filter-presets'];
  const isPublicApi = publicApiPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (!user && isApiRoute && !isPublicApi) {
    const res = NextResponse.json({ error: '未認証' }, { status: 401 });
    // セッションリフレッシュで更新された可能性のあるCookieをコピー
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      res.cookies.set(cookie.name, cookie.value);
    });
    return res;
  }

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // ログイン済みで /login にアクセスした場合は / にリダイレクト
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
