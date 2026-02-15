import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { login as fcLogin, getMypage, getLessonHistory } from '@/lib/feelcycle-api';
import { encrypt } from '@/lib/crypto';
import { upsertHistory } from '@/lib/history-sync';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未認証' }, { status: 401 });
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'メールアドレスとパスワードを入力してください' },
        { status: 400 }
      );
    }

    // 1. FEELCYCLE APIにログイン
    let fcSession;
    try {
      fcSession = await fcLogin(email, password);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'ログインに失敗しました';
      return NextResponse.json({ error: msg }, { status: 401 });
    }

    // 2. FEELCYCLEセッションを暗号化して保存
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

    // 3. FEELCYCLE認証情報を暗号化して保存（自動再認証用）
    //    auth_valid=true にリセット（パスワード変更後の再連携でロック解除）
    await supabaseAdmin
      .from('feelcycle_credentials')
      .upsert({
        user_id: user.id,
        email_encrypted: encrypt(email),
        password_encrypted: encrypt(password),
        auth_valid: true,
        updated_at: new Date().toISOString(),
      });

    // 4. マイページ情報を取得してプロフィール更新
    let mypageInfo = null;
    try {
      const mypage = await getMypage(fcSession);
      mypageInfo = mypage;
      await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: user.id,
          display_name: mypage.displayName,
          home_store: mypage.homeStore,
          membership_type: mypage.membershipType,
          updated_at: new Date().toISOString(),
        });
    } catch (e) {
      console.warn('Mypage fetch failed:', e);
    }

    // 5. 当月の受講履歴を自動同期
    try {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const records = await getLessonHistory(fcSession, ym);
      await upsertHistory(supabaseAdmin, user.id, records, ym);
    } catch (e) {
      console.warn('Auto history sync failed:', e);
    }

    return NextResponse.json({ success: true, mypage: mypageInfo });
  } catch (e) {
    console.error('FEELCYCLE link error:', e);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
