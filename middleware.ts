import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
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
