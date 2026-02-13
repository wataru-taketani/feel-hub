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
  const protectedPaths = ['/mypage', '/history', '/settings'];
  const isProtected = protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // ログイン済みで /login にアクセスした場合は /mypage にリダイレクト
  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/mypage';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
