'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import type { Lesson } from '@/types';

interface WaitlistLesson {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  programName: string;
  instructor: string;
  studio: string;
  isFull: boolean;
  availableSlots: number;
  colorCode: string;
  textColor: string;
  sidHash?: string;
}

interface WaitlistItem {
  id: string;
  lessonId: string;
  notified: boolean;
  autoReserve: boolean;
  preferredSeats: string[] | null;
  lesson: WaitlistLesson | null;
}

export type { WaitlistItem, WaitlistLesson };

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
          map.set(e.lessonId, {
            id: e.id,
            lessonId: e.lessonId,
            notified: e.notified,
            autoReserve: e.autoReserve ?? false,
            preferredSeats: e.preferredSeats ?? null,
            lesson: e.lesson,
          });
        }
        setEntries(map);
        setLoaded(true);
      })
      .catch(() => {});
  }, [user]);

  /** 監視中（notified=false）のエントリのみ true */
  const isOnWaitlist = useCallback(
    (lessonId: string) => {
      const item = entries.get(lessonId);
      return !!item && !item.notified;
    },
    [entries]
  );

  /** 通知済み（notified=true）のエントリがあるか */
  const isNotified = useCallback(
    (lessonId: string) => {
      const item = entries.get(lessonId);
      return !!item && item.notified;
    },
    [entries]
  );

  const addToWaitlist = useCallback(
    async (lesson: Lesson, autoReserve = false, preferredSeats?: string[]) => {
      if (!user) return;

      const seats = preferredSeats && preferredSeats.length > 0 ? preferredSeats : null;

      // 楽観的更新
      const tempId = crypto.randomUUID();
      setEntries((prev) => {
        const next = new Map(prev);
        next.set(lesson.id, {
          id: tempId,
          lessonId: lesson.id,
          notified: false,
          autoReserve,
          preferredSeats: seats,
          lesson: {
            id: lesson.id,
            date: lesson.date,
            startTime: lesson.startTime,
            endTime: lesson.endTime,
            programName: lesson.programName,
            instructor: lesson.instructor,
            studio: lesson.studio,
            isFull: lesson.isFull,
            availableSlots: lesson.availableSlots,
            colorCode: lesson.colorCode,
            textColor: lesson.textColor,
          },
        });
        return next;
      });

      try {
        const res = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessonId: lesson.id, autoReserve, preferredSeats: seats }),
        });
        const data = await res.json();
        if (res.ok && data.entry) {
          // 実際のIDで更新
          setEntries((prev) => {
            const next = new Map(prev);
            const existing = next.get(lesson.id);
            if (existing) {
              next.set(lesson.id, { ...existing, id: data.entry.id });
            }
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

  /** 通知済みエントリを再開（notified → false） */
  const resumeWaitlist = useCallback(
    async (lessonId: string) => {
      if (!user) return;

      const item = entries.get(lessonId);
      if (!item) return;

      // 楽観的更新
      setEntries((prev) => {
        const next = new Map(prev);
        next.set(lessonId, { ...item, notified: false });
        return next;
      });

      try {
        const res = await fetch(`/api/waitlist/${item.id}`, { method: 'PATCH' });
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

  /** 指定レッスンの autoReserve 状態を取得 */
  const getAutoReserve = useCallback(
    (lessonId: string) => {
      const item = entries.get(lessonId);
      return !!item && item.autoReserve;
    },
    [entries]
  );

  /** autoReserve を切り替え */
  const toggleAutoReserve = useCallback(
    async (lessonId: string) => {
      if (!user) return;

      const item = entries.get(lessonId);
      if (!item) return;

      const newValue = !item.autoReserve;

      // 楽観的更新
      setEntries((prev) => {
        const next = new Map(prev);
        next.set(lessonId, { ...item, autoReserve: newValue });
        return next;
      });

      try {
        const res = await fetch(`/api/waitlist/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoReserve: newValue }),
        });
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

  /** 指定レッスンの preferredSeats を取得 */
  const getPreferredSeats = useCallback(
    (lessonId: string): string[] | null => {
      const item = entries.get(lessonId);
      return item?.preferredSeats ?? null;
    },
    [entries]
  );

  /** preferredSeats を設定/変更 */
  const setPreferredSeats = useCallback(
    async (lessonId: string, seats: string[] | null) => {
      if (!user) return;

      const item = entries.get(lessonId);
      if (!item) return;

      const newSeats = seats && seats.length > 0 ? seats : null;

      // 楽観的更新
      setEntries((prev) => {
        const next = new Map(prev);
        next.set(lessonId, { ...item, preferredSeats: newSeats });
        return next;
      });

      try {
        const res = await fetch(`/api/waitlist/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferredSeats: newSeats }),
        });
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

  /** レッスン情報付きの全エントリ配列（HOME表示用） */
  const waitlistEntries = useMemo(() => {
    return Array.from(entries.values())
      .filter((e) => e.lesson)
      .sort((a, b) => {
        // 監視中を先、通知済みを後に
        if (a.notified !== b.notified) return a.notified ? 1 : -1;
        // 同じ状態内は日付順
        const aKey = `${a.lesson!.date}_${a.lesson!.startTime}`;
        const bKey = `${b.lesson!.date}_${b.lesson!.startTime}`;
        return aKey.localeCompare(bKey);
      });
  }, [entries]);

  return {
    isOnWaitlist,
    isNotified,
    getAutoReserve,
    getPreferredSeats,
    addToWaitlist,
    removeFromWaitlist,
    resumeWaitlist,
    toggleAutoReserve,
    setPreferredSeats,
    waitlistEntries,
    loaded,
  };
}
