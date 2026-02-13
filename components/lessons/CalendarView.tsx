'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Pin, PinOff } from 'lucide-react';
import type { Lesson } from '@/types';
import { getTodayDateString, formatDate, getDayOfWeek } from '@/lib/lessonUtils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import CalendarDateColumn from './CalendarDateColumn';
import LessonCard from './LessonCard';

interface CalendarViewProps {
  lessons: Lesson[];
  isBookmarked: (lesson: Lesson) => boolean;
  onToggleBookmark: (lesson: Lesson) => void;
  isReserved?: (lesson: Lesson) => boolean;
  isOnWaitlist?: (lessonId: string) => boolean;
  onTapLesson?: (lesson: Lesson) => void;
}

const COL_WIDTH = 'shrink-0 w-[calc(100%/3)] sm:w-[calc(100%/5)] lg:w-[calc(100%/7)] min-w-[150px]';

export default function CalendarView({ lessons, isBookmarked, onToggleBookmark, isReserved, isOnWaitlist, onTapLesson }: CalendarViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const reservedRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const [pinReserved, setPinReserved] = useState(true);
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

  // 予約済みレッスンを日付ごとに抽出
  const reservedMap = useMemo(() => {
    if (!isReserved) return new Map<string, Lesson[]>();
    const map = new Map<string, Lesson[]>();
    for (const [date, dateLessons] of dateMap) {
      const reserved = dateLessons.filter(l => isReserved(l));
      if (reserved.length > 0) map.set(date, reserved);
    }
    return map;
  }, [dateMap, isReserved]);

  const hasReserved = reservedMap.size > 0;

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

  // 初回表示でのみ今日にスクロール
  useEffect(() => {
    if (initialScrollDone.current) return;
    if (dates.length > 0) {
      initialScrollDone.current = true;
      scrollToToday();
    }
  }, [dates, scrollToToday]);

  const scrollBy = (direction: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const columnWidth = container.firstElementChild
      ? (container.firstElementChild as HTMLElement).offsetWidth
      : 200;
    container.scrollBy({ left: columnWidth * direction, behavior: 'smooth' });
  };

  // 横スクロール同期: body → header + reserved row
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const sl = scrollRef.current.scrollLeft;
      if (headerRef.current) headerRef.current.scrollLeft = sl;
      if (reservedRef.current) reservedRef.current.scrollLeft = sl;
    }
  }, []);

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
        {hasReserved && (
          <Button
            variant={pinReserved ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs px-3 mr-auto"
            onClick={() => setPinReserved(v => !v)}
          >
            {pinReserved ? <Pin className="h-3.5 w-3.5 mr-1" /> : <PinOff className="h-3.5 w-3.5 mr-1" />}
            予約固定
          </Button>
        )}
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

      {/* カレンダーグループ */}
      <div>
        {/* 日付ヘッダー行（sticky） */}
        <div className="sticky top-14 z-20 border border-b-0 rounded-t-lg overflow-hidden bg-card">
          <div ref={headerRef} className="flex overflow-hidden">
            {dates.map((date) => {
              const dow = getDayOfWeek(date);
              return (
                <div
                  key={date}
                  className={cn(
                    COL_WIDTH,
                    'text-center text-xs font-semibold py-1 border-r border-b border-border last:border-r-0',
                    dow === 6
                      ? 'bg-blue-50 text-blue-700'
                      : dow === 0
                        ? 'bg-red-50 text-red-700'
                        : 'bg-card text-foreground'
                  )}
                >
                  {formatDate(date)}
                </div>
              );
            })}
          </div>
        </div>

        {/* 予約済みレッスン固定行（sticky・ピン有効時のみ） */}
        {hasReserved && pinReserved && (
          <div className="sticky top-[82px] z-[15] border-x border-border overflow-hidden bg-card">
            <div ref={reservedRef} className="flex overflow-hidden">
              {dates.map((date) => {
                const reserved = reservedMap.get(date);
                return (
                  <div key={date} className={cn(COL_WIDTH, 'border-r border-border last:border-r-0')}>
                    {reserved?.map((lesson) => (
                      <LessonCard
                        key={lesson.id}
                        lesson={lesson}
                        isBookmarked={isBookmarked(lesson)}
                        onToggleBookmark={onToggleBookmark}
                        isReserved
                        isOnWaitlist={isOnWaitlist?.(lesson.id) ?? false}
                        onTapLesson={onTapLesson}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* カレンダー本体（横スクロール） */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory calendar-scroll border border-t-0 rounded-b-lg bg-card shadow-sm"
          onScroll={handleScroll}
        >
          {dates.map((date) => {
            const dateLessons = dateMap.get(date) || [];
            const displayLessons = (isReserved && pinReserved)
              ? dateLessons.filter(l => !isReserved(l))
              : dateLessons;
            return (
              <CalendarDateColumn
                key={date}
                date={date}
                lessons={displayLessons}
                isBookmarked={isBookmarked}
                onToggleBookmark={onToggleBookmark}
                isReserved={pinReserved ? undefined : isReserved}
                isToday={date === today}
                isOnWaitlist={isOnWaitlist}
                onTapLesson={onTapLesson}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
