'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLessonKey } from '@/lib/lessonUtils';
import { useAuthContext } from '@/contexts/AuthContext';
import type { Lesson, BookmarkEntry } from '@/types';

export function useBookmarks() {
  const { user } = useAuthContext();
  const [bookmarks, setBookmarks] = useState<Record<string, BookmarkEntry>>({});
  const [loaded, setLoaded] = useState(false);
  const fetchedForUser = useRef<string | null>(null);

  // ログイン時: APIからブックマーク読み込み
  useEffect(() => {
    if (!user) {
      setBookmarks({});
      setLoaded(false);
      fetchedForUser.current = null;
      return;
    }

    // 同じユーザーで既に取得済みなら再取得しない
    if (fetchedForUser.current === user.id) return;
    fetchedForUser.current = user.id;

    fetch('/api/bookmarks')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.bookmarks) {
          setBookmarks(data.bookmarks);
        }
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
      });
  }, [user]);

  const toggle = useCallback(
    (lesson: Lesson) => {
      if (!user) return;

      const key = getLessonKey(lesson);
      const exists = !!bookmarks[key];

      if (exists) {
        // 楽観的削除
        setBookmarks((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });

        fetch('/api/bookmarks', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        }).catch(() => {
          // 失敗時: 元に戻す
          setBookmarks((prev) => ({
            ...prev,
            [key]: {
              key,
              date: lesson.date,
              startTime: lesson.startTime,
              programName: lesson.programName,
              instructor: lesson.instructor,
              studio: lesson.studio,
              addedAt: Date.now(),
            },
          }));
        });
      } else {
        // 楽観的追加
        const entry: BookmarkEntry = {
          key,
          date: lesson.date,
          startTime: lesson.startTime,
          programName: lesson.programName,
          instructor: lesson.instructor,
          studio: lesson.studio,
          addedAt: Date.now(),
        };
        setBookmarks((prev) => ({ ...prev, [key]: entry }));

        fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key,
            date: lesson.date,
            startTime: lesson.startTime,
            programName: lesson.programName,
            instructor: lesson.instructor,
            studio: lesson.studio,
          }),
        }).then((res) => {
          if (!res.ok) {
            // 失敗時: 元に戻す
            setBookmarks((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }
        }).catch(() => {
          setBookmarks((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        });
      }
    },
    [user, bookmarks]
  );

  const isBookmarked = useCallback(
    (lesson: Lesson) => {
      return !!bookmarks[getLessonKey(lesson)];
    },
    [bookmarks]
  );

  return { bookmarks, toggle, isBookmarked, loaded };
}
