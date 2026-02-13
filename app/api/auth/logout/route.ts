import { NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const supabaseAdmin = createSupabaseAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const supabase = await createClient();

  // ユーザーIDを取得してFEELCYCLEセッションを削除
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabaseAdmin
      .from('feelcycle_sessions')
      .delete()
      .eq('user_id', user.id);
  }

  await supabase.auth.signOut();

  return NextResponse.json({ success: true });
}
