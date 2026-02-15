'use client';

import { useMemo } from 'react';
import type { Lesson } from '@/types';
import LessonCard from './LessonCard';

interface CalendarDateColumnProps {
  date: string;
  lessons: Lesson[];
  isBookmarked: (lesson: Lesson) => boolean;
  onToggleBookmark: (lesson: Lesson) => void;
  isReserved?: (lesson: Lesson) => boolean;
  getSheetNo?: (lesson: Lesson) => string | null;
  isToday: boolean;
  isOnWaitlist?: (lessonId: string) => boolean;
  onTapLesson?: (lesson: Lesson) => void;
}

export default function CalendarDateColumn({ date, lessons, isBookmarked, onToggleBookmark, isReserved, getSheetNo, isOnWaitlist, onTapLesson }: CalendarDateColumnProps) {
  // 予約済みレッスンを先頭に（同グループ内は元の時間順を維持）
  const sortedLessons = useMemo(() => {
    if (!isReserved) return lessons;
    return [...lessons].sort((a, b) => {
      const aR = isReserved(a) ? 0 : 1;
      const bR = isReserved(b) ? 0 : 1;
      return aR - bR;
    });
  }, [lessons, isReserved]);

  return (
    <div className="snap-start shrink-0 w-[calc(100%/3)] sm:w-[calc(100%/5)] lg:w-[calc(100%/7)] min-w-[150px] border-r border-border last:border-r-0">
      {sortedLessons.length > 0 ? (
        sortedLessons.map((lesson) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            isBookmarked={isBookmarked(lesson)}
            onToggleBookmark={onToggleBookmark}
            isReserved={isReserved?.(lesson) ?? false}
            sheetNo={getSheetNo?.(lesson) || null}
            isOnWaitlist={isOnWaitlist?.(lesson.id) ?? false}
            onTapLesson={onTapLesson}
          />
        ))
      ) : (
        <div className="text-xs text-muted-foreground text-center py-8">レッスンなし</div>
      )}
    </div>
  );
}
