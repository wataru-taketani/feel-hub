import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // アクセスログ（CloudWatch Logs に記録）
  const ua = request.headers.get('user-agent') || '-';
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '-';
  const path = request.nextUrl.pathname;
  const isBot = /bot|crawler|spider|crawling|facebookexternalhit|Bytespider|GPTBot|Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|ia_archiver|SemrushBot|AhrefsBot|MJ12bot|DotBot|PetalBot/i.test(ua);
  console.log(JSON.stringify({ type: 'access', path, ip, isBot, ua: ua.slice(0, 200) }));

  return await updateSession(request);
}

export const config = {
  matcher: [
    // 認証必須ページ（/login以外の全ページ）
    '/',
    '/lessons',
    '/mypage/:path*',
    '/history/:path*',
    '/groups/:path*',
    // ログイン済み→TOPリダイレクト
    '/login',
    // 認証必須API（/api/auth/* のみ除外）
    '/api/dashboard',
    '/api/profile/:path*',
    '/api/reservations',
    '/api/groups/:path*',
    '/api/mypage',
    '/api/waitlist/:path*',
    '/api/bookmarks/:path*',
    '/api/reserve',
    '/api/fc-sync',
    '/api/history/:path*',
    '/api/seatmap/:path*',
    '/api/seat-preferences/:path*',
    '/api/lessons/:path*',
    '/api/studios',
    '/api/programs',
    '/api/filter-presets',
  ],
};
