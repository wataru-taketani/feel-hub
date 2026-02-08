'use client';

import type { Lesson } from '@/types';
import { formatDate, getDayOfWeek } from '@/lib/lessonUtils';
import { cn } from '@/lib/utils';
import LessonCard from './LessonCard';

interface CalendarDateColumnProps {
  date: string;
  lessons: Lesson[];
  isBookmarked: (lesson: Lesson) => boolean;
  onToggleBookmark: (lesson: Lesson) => void;
  isToday: boolean;
}

export default function CalendarDateColumn({ date, lessons, isBookmarked, onToggleBookmark, isToday }: CalendarDateColumnProps) {
  const dow = getDayOfWeek(date);

  return (
    <div className="snap-start shrink-0 w-[calc(100%/3)] sm:w-[calc(100%/5)] lg:w-[calc(100%/7)] min-w-[150px] border-r border-border last:border-r-0">
      {/* 日付ヘッダー */}
      <div
        className={cn(
          'sticky top-0 z-10 text-center text-xs font-semibold py-1 border-b',
          dow === 6
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : dow === 0
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-card border-border text-foreground'
        )}
      >
        {formatDate(date)}
      </div>

      {/* レッスンカード群 */}
      <div>
        {lessons.length > 0 ? (
          lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              isBookmarked={isBookmarked(lesson)}
              onToggleBookmark={onToggleBookmark}
            />
          ))
        ) : (
          <div className="text-xs text-muted-foreground text-center py-8">レッスンなし</div>
        )}
      </div>
    </div>
  );
}
