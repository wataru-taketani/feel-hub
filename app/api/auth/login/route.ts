import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { login as fcLogin, getMypage, getLessonHistory } from '@/lib/feelcycle-api';
import { encrypt, derivePassword } from '@/lib/crypto';
import { upsertHistory } from '@/lib/history-sync';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
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

    // 2. Supabase Authユーザー作成 or ログイン
    const derivedPassword = derivePassword(email);

    const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            pendingCookies.length = 0;
            cookiesToSet.forEach(({ name, value, options }) => {
              pendingCookies.push({ name, value, options });
            });
          },
        },
      }
    );

    let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: derivedPassword,
    });

    // ユーザーが存在しない場合は作成
    if (signInError && signInError.message.includes('Invalid login credentials')) {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: derivedPassword,
        email_confirm: true,
      });

      if (createError) {
        console.error('User creation error:', createError);
        return NextResponse.json(
          { error: 'アカウントの作成に失敗しました' },
          { status: 500 }
        );
      }

      const result = await supabase.auth.signInWithPassword({
        email,
        password: derivedPassword,
      });
      signInData = result.data;
      signInError = result.error;
    }

    if (signInError || !signInData.user) {
      console.error('Sign in error:', signInError);
      return NextResponse.json(
        { error: 'Supabase認証に失敗しました' },
        { status: 500 }
      );
    }

    const userId = signInData.user.id;

    // 3. FEELCYCLEセッションを暗号化して保存
    const sessionEncrypted = encrypt(JSON.stringify(fcSession));
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('feelcycle_sessions')
      .upsert({
        user_id: userId,
        session_encrypted: sessionEncrypted,
        expires_at: expiresAt,
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
          id: userId,
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
      await upsertHistory(supabaseAdmin, userId, records, ym);
    } catch (e) {
      console.warn('Auto history sync failed:', e);
      // 失敗してもログイン自体は成功させる
    }

    // 最終レスポンスを作成し、収集したCookieをオプション付きで設定
    const response = NextResponse.json({ success: true, mypage: mypageInfo });
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }

    return response;
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
