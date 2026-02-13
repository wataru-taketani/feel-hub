'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import type { Lesson } from '@/types';

interface WaitlistItem {
  id: string;
  lessonId: string;
}

export function useWaitlist() {
  const { user } = useAuthContext();
  const [entries, setEntries] = useState<Map<string, WaitlistItem>>(new Map());
  const [loaded, setLoaded] = useState(false);

  // ログイン時にウェイトリストを取得
  useEffect(() => {
    if (!user) {
      setEntries(new Map());
      setLoaded(false);
      return;
    }

    fetch('/api/waitlist')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.entries) return;
        const map = new Map<string, WaitlistItem>();
        for (const e of data.entries) {
          map.set(e.lessonId, { id: e.id, lessonId: e.lessonId });
        }
        setEntries(map);
        setLoaded(true);
      })
      .catch(() => {});
  }, [user]);

  const isOnWaitlist = useCallback(
    (lessonId: string) => entries.has(lessonId),
    [entries]
  );

  const addToWaitlist = useCallback(
    async (lesson: Lesson) => {
      if (!user) return;

      // 楽観的更新
      const tempId = crypto.randomUUID();
      setEntries((prev) => {
        const next = new Map(prev);
        next.set(lesson.id, { id: tempId, lessonId: lesson.id });
        return next;
      });

      try {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: lesson.id }),
        });
        const data = await res.json();
        if (res.ok && data.entry) {
          // 実際のIDで更新
          setEntries((prev) => {
            const next = new Map(prev);
            next.set(lesson.id, { id: data.entry.id, lessonId: lesson.id });
            return next;
          });
        }
      } catch {
        // ロールバック
        setEntries((prev) => {
          const next = new Map(prev);
          next.delete(lesson.id);
          return next;
        });
      }
    },
    [user]
  );

  const removeFromWaitlist = useCallback(
    async (lessonId: string) => {
      if (!user) return;

      const item = entries.get(lessonId);
      if (!item) return;

      // 楽観的更新
      setEntries((prev) => {
        const next = new Map(prev);
        next.delete(lessonId);
        return next;
      });

      try {
        const res = await fetch(`/api/waitlist/${item.id}`, { method: 'DELETE' });
        if (!res.ok) {
          // ロールバック
          setEntries((prev) => {
            const next = new Map(prev);
            next.set(lessonId, item);
            return next;
          });
        }
      } catch {
        // ロールバック
        setEntries((prev) => {
          const next = new Map(prev);
          next.set(lessonId, item);
          return next;
        });
      }
    },
    [user, entries]
  );

  return { isOnWaitlist, addToWaitlist, removeFromWaitlist, loaded };
}
