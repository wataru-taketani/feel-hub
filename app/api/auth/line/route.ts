import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function GET(request: NextRequest) {
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.json(
      { error: 'LINE Login is not configured' },
      { status: 500 }
    );
  }

  const state = randomBytes(32).toString('hex');
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/auth/line/callback`;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: channelId,
    redirect_uri: redirectUri,
    state,
    scope: 'profile openid',
    bot_prompt: 'aggressive',
  });

  const authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params}`;

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('line_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  return response;
}
