'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { getLessonKey, getTodayDateString } from '@/lib/lessonUtils';
import { useAuthContext } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import type { Lesson, BookmarkEntry } from '@/types';

export function useBookmarks() {
  const { user } = useAuthContext();
  const [localBookmarks, setLocalBookmarks] = useLocalStorage<Record<string, BookmarkEntry>>('feelhub_bookmarks', {});
  const [cloudBookmarks, setCloudBookmarks] = useState<Record<string, BookmarkEntry>>({});
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const migrated = useRef(false);
  const supabase = createClient();

  const bookmarks = user ? cloudBookmarks : localBookmarks;

  // ログイン時: Supabaseからブックマーク読み込み
  useEffect(() => {
    if (!user) {
      setCloudLoaded(false);
      return;
    }

    supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const map: Record<string, BookmarkEntry> = {};
        for (const row of data || []) {
          map[row.lesson_key] = {
            key: row.lesson_key,
            date: row.date,
            startTime: row.start_time,
            programName: row.program_name,
            instructor: row.instructor,
            studio: row.studio,
            addedAt: new Date(row.added_at).getTime(),
          };
        }
        setCloudBookmarks(map);
        setCloudLoaded(true);
      });
  }, [user, supabase]);

  // ログイン直後: localStorageからSupabaseにマイグレーション
  useEffect(() => {
    if (!user || !cloudLoaded || migrated.current) return;
    migrated.current = true;

    const localEntries = Object.values(localBookmarks);
    if (localEntries.length === 0) return;

    const today = getTodayDateString();
    const validEntries = localEntries.filter((b) => b.date >= today);
    if (validEntries.length === 0) return;

    const rows = validEntries.map((b) => ({
      user_id: user.id,
      lesson_key: b.key,
      date: b.date,
      start_time: b.startTime,
      program_name: b.programName,
      instructor: b.instructor,
      studio: b.studio,
    }));

    supabase
      .from('bookmarks')
      .upsert(rows, { onConflict: 'user_id,lesson_key' })
      .then(({ error }) => {
        if (!error) {
          // マイグレーション成功: localStorageクリア
          setLocalBookmarks({});
          // cloudBookmarksを更新
          setCloudBookmarks((prev) => {
            const next = { ...prev };
            for (const b of validEntries) {
              next[b.key] = b;
            }
            return next;
          });
        }
      });
  }, [user, cloudLoaded, localBookmarks, setLocalBookmarks, supabase]);

  // 過去日付のブックマークを自動クリーンアップ（localStorageのみ）
  useEffect(() => {
    if (user) return; // ログイン時はクラウド側で管理
    const today = getTodayDateString();
    const hasExpired = Object.values(localBookmarks).some((b) => b.date < today);
    if (hasExpired) {
      setLocalBookmarks((prev) => {
        const cleaned: Record<string, BookmarkEntry> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v.date >= today) cleaned[k] = v;
        }
        return cleaned;
      });
    }
  }, [user, localBookmarks, setLocalBookmarks]);

  const toggle = useCallback(
    (lesson: Lesson) => {
      const key = getLessonKey(lesson);

      if (user) {
        // Supabase操作（楽観的更新）
        const exists = !!cloudBookmarks[key];
        if (exists) {
          setCloudBookmarks((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
          supabase.from('bookmarks').delete().eq('user_id', user.id).eq('lesson_key', key);
        } else {
          const entry: BookmarkEntry = {
            key,
            date: lesson.date,
            startTime: lesson.startTime,
            programName: lesson.programName,
            instructor: lesson.instructor,
            studio: lesson.studio,
            addedAt: Date.now(),
          };
          setCloudBookmarks((prev) => ({ ...prev, [key]: entry }));
          supabase.from('bookmarks').upsert({
            user_id: user.id,
            lesson_key: key,
            date: lesson.date,
            start_time: lesson.startTime,
            program_name: lesson.programName,
            instructor: lesson.instructor,
            studio: lesson.studio,
          }, { onConflict: 'user_id,lesson_key' });
        }
      } else {
        // localStorage操作（既存動作）
        setLocalBookmarks((prev) => {
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
      }
    },
    [user, cloudBookmarks, setLocalBookmarks, supabase]
  );

  const isBookmarked = useCallback(
    (lesson: Lesson) => {
      return !!bookmarks[getLessonKey(lesson)];
    },
    [bookmarks]
  );

  return { bookmarks, toggle, isBookmarked };
}
