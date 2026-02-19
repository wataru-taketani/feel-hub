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

  // セッションの更新（エラーが出てもリクエストを続行する）
  try {
    await supabase.auth.getUser();
  } catch {
    // Cookieが壊れている・セッションが無効な場合でも続行
    // 400/401エラーでサイトが壊れないようにする
  }

  return supabaseResponse;
}
