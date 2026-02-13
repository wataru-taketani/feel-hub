import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const origin = request.nextUrl.origin;

  // User denied or LINE returned error
  if (error) {
    return NextResponse.redirect(`${origin}/mypage?line=error&reason=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/mypage?line=error&reason=missing_params`);
  }

  // CSRF verification
  const savedState = request.cookies.get('line_oauth_state')?.value;
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${origin}/mypage?line=error&reason=invalid_state`);
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID!;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET!;
  const redirectUri = `${origin}/api/auth/line/callback`;

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    });

    if (!tokenRes.ok) {
      console.error('LINE token exchange failed:', await tokenRes.text());
      return NextResponse.redirect(`${origin}/mypage?line=error&reason=token_failed`);
    }

    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;

    if (!idToken) {
      return NextResponse.redirect(`${origin}/mypage?line=error&reason=no_id_token`);
    }

    // Verify id_token to extract LINE User ID
    const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: channelId,
      }),
    });

    if (!verifyRes.ok) {
      console.error('LINE id_token verify failed:', await verifyRes.text());
      return NextResponse.redirect(`${origin}/mypage?line=error&reason=verify_failed`);
    }

    const verifyData = await verifyRes.json();
    const lineUserId = verifyData.sub;

    if (!lineUserId) {
      return NextResponse.redirect(`${origin}/mypage?line=error&reason=no_sub`);
    }

    // Get current Supabase user (must be logged in)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origin}/mypage?line=error&reason=not_logged_in`);
    }

    // Save LINE User ID to user_profiles
    const { error: dbError } = await supabase
      .from('user_profiles')
      .upsert({
        id: user.id,
        line_user_id: lineUserId,
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('Failed to save LINE User ID:', dbError);
      return NextResponse.redirect(`${origin}/mypage?line=error&reason=db_error`);
    }

    // Clean up state cookie and redirect
    const response = NextResponse.redirect(`${origin}/mypage?line=linked`);
    response.cookies.delete('line_oauth_state');
    return response;
  } catch (e) {
    console.error('LINE callback error:', e);
    return NextResponse.redirect(`${origin}/mypage?line=error&reason=unknown`);
  }
}
