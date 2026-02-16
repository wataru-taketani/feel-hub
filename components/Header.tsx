'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, LogOut, BookOpen, CalendarDays } from 'lucide-react';

export default function Header() {
  const { user, loading, logout } = useAuthContext();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-primary">
          Feel Hub
        </Link>

        <nav className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/lessons">
              <CalendarDays className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">レッスン</span>
            </Link>
          </Button>

          {loading ? null : user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/mypage">
                  <User className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">マイページ</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/history">
                  <BookOpen className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">履歴</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowLogoutDialog(true)}>
                <LogOut className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">ログアウト</span>
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
