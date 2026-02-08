'use client';

import { useCallback, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { getLessonKey, getTodayDateString } from '@/lib/lessonUtils';
import type { Lesson, BookmarkEntry } from '@/types';

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useLocalStorage<Record<string, BookmarkEntry>>('feelhub_bookmarks', {});

  // 過去日付のブックマークを自動クリーンアップ
  useEffect(() => {
    const today = getTodayDateString();
    const hasExpired = Object.values(bookmarks).some((b) => b.date < today);
    if (hasExpired) {
      setBookmarks((prev) => {
        const cleaned: Record<string, BookmarkEntry> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.date >= today) cleaned[k] = v;
        }
        return cleaned;
      });
    }
  }, [bookmarks, setBookmarks]);

  const toggle = useCallback(
    (lesson: Lesson) => {
      const key = getLessonKey(lesson);
      setBookmarks((prev) => {
        if (prev[key]) {
          const next = { ...prev };
          delete next[key];
          return next;
        }
        return {
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
        };
      });
    },
    [setBookmarks]
  );

  const isBookmarked = useCallback(
    (lesson: Lesson) => {
      return !!bookmarks[getLessonKey(lesson)];
    },
    [bookmarks]
  );

  return { bookmarks, toggle, isBookmarked };
}
