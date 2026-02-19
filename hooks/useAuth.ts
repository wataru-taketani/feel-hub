'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // 初期ユーザー取得
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Auth状態変化を監視（同一ユーザーなら参照を維持し不要な再レンダーを防ぐ）
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const next = session?.user ?? null;
        setUser(prev => {
          if (prev?.id === next?.id) return prev;
          return next;
        });
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/login';
  }, []);

  return { user, loading, logout };
}
