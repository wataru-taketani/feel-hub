import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { login as fcLogin } from '@/lib/feelcycle-api';
import { encrypt, decrypt } from '@/lib/crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未認証' }, { status: 401 });
    }

    // 1. 保存済みFEELCYCLE認証情報を取得・復号
    const { data: creds } = await supabaseAdmin
      .from('feelcycle_credentials')
      .select('email_encrypted, password_encrypted')
      .eq('user_id', user.id)
      .single();

    if (!creds) {
      return NextResponse.json(
        { error: 'FEELCYCLE認証情報が保存されていません', code: 'FC_NOT_LINKED' },
        { status: 404 }
      );
    }

    let email: string;
    let password: string;
    try {
      email = decrypt(creds.email_encrypted);
      password = decrypt(creds.password_encrypted);
    } catch {
      return NextResponse.json(
        { error: '認証情報の復号に失敗しました', code: 'DECRYPT_FAILED' },
        { status: 500 }
      );
    }

    // 2. FEELCYCLE APIに再ログイン
    let fcSession;
    try {
      fcSession = await fcLogin(email, password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '再認証に失敗しました';
      return NextResponse.json(
        { error: msg, code: 'FC_REAUTH_FAILED' },
        { status: 401 }
      );
    }

    // 3. 新セッションを保存
    const sessionEncrypted = encrypt(JSON.stringify(fcSession));
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('feelcycle_sessions')
      .upsert({
        user_id: user.id,
        session_encrypted: sessionEncrypted,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('FEELCYCLE reauth error:', e);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
