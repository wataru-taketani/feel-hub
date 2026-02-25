'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, LogOut, BookOpen, CalendarDays } from 'lucide-react';

export default function Header() {
  const { user, loading, logout } = useAuthContext();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const pathname = usePathname();

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname === href) {
      e.preventDefault();
      window.location.reload();
    }
  }, [pathname]);

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-primary" onClick={(e) => handleNavClick(e, '/')}>
          FEEL hub
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1 -mr-2">
          <Button variant="ghost" size="sm" className="flex-col h-auto gap-0 px-2 py-1 sm:flex-row sm:h-8 sm:gap-1 sm:px-3 sm:py-0" asChild>
            <Link href="/lessons" onClick={(e) => handleNavClick(e, '/lessons')}>
              <CalendarDays className="h-4 w-4" />
              <span className="text-[10px] sm:text-sm leading-tight">レッスン</span>
            </Link>
          </Button>

          {loading ? null : user ? (
            <>
              <Button variant="ghost" size="sm" className="flex-col h-auto gap-0 px-2 py-1 sm:flex-row sm:h-8 sm:gap-1 sm:px-3 sm:py-0" asChild>
                <Link href="/mypage" onClick={(e) => handleNavClick(e, '/mypage')}>
                  <User className="h-4 w-4" />
                  <span className="text-[10px] sm:text-sm leading-tight">マイページ</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="flex-col h-auto gap-0 px-2 py-1 sm:flex-row sm:h-8 sm:gap-1 sm:px-3 sm:py-0" asChild>
                <Link href="/history" onClick={(e) => handleNavClick(e, '/history')}>
                  <BookOpen className="h-4 w-4" />
                  <span className="text-[10px] sm:text-sm leading-tight">履歴</span>
                </Link>
              </Button>
              <div className="w-px h-6 bg-border mx-1 sm:mx-1.5" />
              <Button variant="ghost" size="sm" className="flex-col h-auto gap-0 px-2 py-1 sm:flex-row sm:h-8 sm:gap-1 sm:px-3 sm:py-0" onClick={() => setShowLogoutDialog(true)}>
                <LogOut className="h-4 w-4" />
                <span className="text-[10px] sm:text-sm leading-tight">ログアウト</span>
              </Button>

              {showLogoutDialog && (
                <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                  <DialogContent className="max-w-xs">
                    <DialogHeader>
                      <DialogTitle>ログアウト</DialogTitle>
                      <DialogDescription>ログアウトしますか？</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-row gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setShowLogoutDialog(false)}>
                        キャンセル
                      </Button>
                      <Button variant="destructive" className="flex-1" onClick={() => { setShowLogoutDialog(false); logout(); }}>
                        ログアウト
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </>
          ) : (
            <Button variant="default" size="sm" asChild>
              <Link href="/login">ログイン</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
