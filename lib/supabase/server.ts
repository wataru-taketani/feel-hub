import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * サーバーコンポーネント用のSupabaseクライアント
 *
 * 使用例:
 * import { createClient } from '@/lib/supabase/server';
 *
 * const supabase = await createClient();
 * const { data, error } = await supabase.from('table').select();
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // サーバーコンポーネントからのset呼び出しは無視
            // ミドルウェアやRoute Handlersで処理される
          }
        },
      },
    }
  );
}
