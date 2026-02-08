'use client';

import { useRef, useCallback, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import type { Lesson } from '@/types';
import { getTodayDateString } from '@/lib/lessonUtils';
import { Button } from '@/components/ui/button';
import CalendarDateColumn from './CalendarDateColumn';

interface CalendarViewProps {
  lessons: Lesson[];
  isBookmarked: (lesson: Lesson) => boolean;
  onToggleBookmark: (lesson: Lesson) => void;
}

export default function CalendarView({ lessons, isBookmarked, onToggleBookmark }: CalendarViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => getTodayDateString(), []);

  // 日付でグループ化（ソート済み）
  const dateMap = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const lesson of lessons) {
      const arr = map.get(lesson.date);
      if (arr) {
        arr.push(lesson);
      } else {
        map.set(lesson.date, [lesson]);
      }
    }
    return map;
  }, [lessons]);

  const dates = useMemo(() => [...dateMap.keys()].sort(), [dateMap]);

  // 今日の列にスクロール
  const scrollToToday = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const todayIndex = dates.indexOf(today);
    if (todayIndex < 0) return;
    const columnWidth = container.firstElementChild
      ? (container.firstElementChild as HTMLElement).offsetWidth
      : 0;
    container.scrollTo({ left: columnWidth * todayIndex, behavior: 'smooth' });
  }, [dates, today]);

  // 初回表示で今日にスクロール
  useEffect(() => {
    scrollToToday();
  }, [scrollToToday]);

  const scrollBy = (direction: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const columnWidth = container.firstElementChild
      ? (container.firstElementChild as HTMLElement).offsetWidth
      : 200;
    container.scrollBy({ left: columnWidth * direction, behavior: 'smooth' });
  };

  if (dates.length === 0) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-12 text-center">
        <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">レッスンが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* ナビゲーションボタン */}
      <div className="flex items-center justify-end gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scrollBy(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={scrollToToday}>
          <CalendarDays className="h-3.5 w-3.5 mr-1" />
          今日
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scrollBy(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* カレンダー本体 */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto snap-x snap-mandatory calendar-scroll rounded-lg border bg-card shadow-sm"
      >
        {dates.map((date) => (
          <CalendarDateColumn
            key={date}
            date={date}
            lessons={dateMap.get(date) || []}
            isBookmarked={isBookmarked}
            onToggleBookmark={onToggleBookmark}
            isToday={date === today}
          />
        ))}
      </div>
    </div>
  );
}
