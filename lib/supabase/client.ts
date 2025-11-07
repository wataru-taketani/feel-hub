import { createBrowserClient } from '@supabase/ssr';

/**
 * クライアントコンポーネント用のSupabaseクライアント
 *
 * 使用例:
 * "use client";
 * import { createClient } from '@/lib/supabase/client';
 *
 * const supabase = createClient();
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
