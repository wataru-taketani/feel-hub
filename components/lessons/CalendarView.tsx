'use client';

import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CalendarDays } from 'lucide-react';
import type { Lesson } from '@/types';
import { getTodayDateString, formatDate, getDayOfWeek } from '@/lib/lessonUtils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import CalendarDateColumn from './CalendarDateColumn';
import LessonCard from './LessonCard';

interface CalendarViewProps {
  lessons: Lesson[];
  allDates?: string[];
  reservedLessons?: Lesson[];
  bookmarkedLessons?: Lesson[];
  isBookmarked: (lesson: Lesson) => boolean;
  onToggleBookmark: (lesson: Lesson) => void;
  isReserved?: (lesson: Lesson) => boolean;
  getSheetNo?: (lesson: Lesson) => string | null;
  isOnWaitlist?: (lessonId: string) => boolean;
  onTapLesson?: (lesson: Lesson) => void;
  bookmarkOnly?: boolean;
  /** ナビ行の左側に追加するコンテンツ */
  toolbarLeft?: React.ReactNode;
  /** ナビ行の右側に追加するコンテンツ */
  toolbarRight?: React.ReactNode;
  /** ナビ行とカレンダーの間に挿入するコンテンツ */
  middleContent?: React.ReactNode;
}

const COL_WIDTH = 'shrink-0 w-[calc(100%/3)] sm:w-[calc(100%/5)] lg:w-[calc(100%/7)] min-w-[150px]';

export default function CalendarView({ lessons, allDates, reservedLessons, bookmarkedLessons, isBookmarked, onToggleBookmark, isReserved, getSheetNo, isOnWaitlist, onTapLesson, bookmarkOnly, toolbarLeft, toolbarRight, middleContent }: CalendarViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const reservedRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
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

  const dates = useMemo(() => {
    if (allDates && allDates.length > 0) return allDates;
    return [...dateMap.keys()].sort();
  }, [dateMap, allDates]);

  // 固定行に表示するレッスン（予約済み + ブックマーク済み、時間順）
  const pinnedMap = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    const pinnedIds = new Set<string>();
    // 予約済み
    for (const l of reservedLessons || []) {
      const arr = map.get(l.date) || [];
      arr.push(l);
      map.set(l.date, arr);
      pinnedIds.add(l.id);
    }
    // ブックマーク済み（重複除外）
    for (const l of bookmarkedLessons || []) {
      if (!pinnedIds.has(l.id)) {
        const arr = map.get(l.date) || [];
        arr.push(l);
        map.set(l.date, arr);
      }
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [reservedLessons, bookmarkedLessons]);

  const hasPinnable = pinnedMap.size > 0;
  const [pinnedCollapsed, setPinnedCollapsed] = useState(false);

  // 固定行の合計件数
  const pinnedCount = useMemo(() => {
    let count = 0;
    for (const [, arr] of pinnedMap) count += arr.length;
    return count;
  }, [pinnedMap]);

  // snap-mandatory を一時無効化してスクロール
  const scrollWithoutSnap = useCallback((container: HTMLElement, left: number) => {
    container.style.scrollSnapType = 'none';
    container.scrollTo({ left, behavior: 'smooth' });
    const onEnd = () => {
      container.style.scrollSnapType = '';
      container.removeEventListener('scrollend', onEnd);
    };
    container.addEventListener('scrollend', onEnd);
    // fallback: scrollend未対応ブラウザ用
    setTimeout(() => { container.style.scrollSnapType = ''; }, 500);
  }, []);

  // 今日の列にスクロール
  const scrollToToday = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const todayIndex = dates.indexOf(today);
    if (todayIndex < 0) return;
    const columnWidth = container.firstElementChild
      ? (container.firstElementChild as HTMLElement).offsetWidth
      : 0;
    scrollWithoutSnap(container, columnWidth * todayIndex);
  }, [dates, today, scrollWithoutSnap]);

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
    scrollWithoutSnap(container, container.scrollLeft + columnWidth * direction);
  };

  // 横スクロール同期（3エリア双方向）
  const isSyncing = useRef(false);
  const syncScroll = useCallback((source: HTMLElement) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    const sl = source.scrollLeft;
    if (headerRef.current && headerRef.current !== source) headerRef.current.scrollLeft = sl;
    if (reservedRef.current && reservedRef.current !== source) reservedRef.current.scrollLeft = sl;
    if (scrollRef.current && scrollRef.current !== source) scrollRef.current.scrollLeft = sl;
    requestAnimationFrame(() => { isSyncing.current = false; });
  }, []);

  // 折り畳み解除時に固定行のスクロール位置を同期
  useEffect(() => {
    if (!pinnedCollapsed && reservedRef.current && scrollRef.current) {
      reservedRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  }, [pinnedCollapsed]);

  if (dates.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          {toolbarLeft}
          <div className="flex-1" />
          {middleContent}
        </div>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-12 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">レッスンが見つかりません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* ツールバー（1行に統合） */}
      <div className="flex items-center gap-1">
        {toolbarLeft}
        <div className="flex-1" />
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scrollBy(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 text-xs px-2 sm:px-3" onClick={scrollToToday}>
          <CalendarDays className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">今日</span>
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => scrollBy(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {toolbarRight}
      </div>

      {/* フィルタパネル（外部から挿入） */}
      {middleContent}

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

        {/* 固定行（sticky：予約済み + ブックマークON時はブックマーク済みも） */}
        {hasPinnable && (
          <div className="sticky top-[82px] z-[15] border-x border-border overflow-hidden bg-card">
            {!pinnedCollapsed && (
              <div ref={reservedRef} className="flex overflow-x-auto calendar-scroll" onScroll={(e) => syncScroll(e.currentTarget)}>
                {dates.map((date) => {
                  const pinned = pinnedMap.get(date);
                  return (
                    <div key={date} className={cn(COL_WIDTH, 'border-r border-border last:border-r-0')}>
                      {pinned?.map((lesson) => (
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
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
            {/* トグルバー */}
            <button
              type="button"
              onClick={() => setPinnedCollapsed((v) => !v)}
              className="w-full flex items-center justify-center gap-1 h-6 text-[10px] text-muted-foreground border-t border-b-2 border-b-red-300 active:bg-accent/30"
            >
              <span>予約・ブックマーク {pinnedCount}件</span>
              {pinnedCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>
          </div>
        )}

        {/* カレンダー本体（横スクロール） */}
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory calendar-scroll border border-t-0 rounded-b-lg bg-card shadow-sm"
          onScroll={(e) => syncScroll(e.currentTarget)}
        >
          {dates.map((date) => {
            const dateLessons = dateMap.get(date) || [];
            return (
              <CalendarDateColumn
                key={date}
                date={date}
                lessons={dateLessons}
                isBookmarked={isBookmarked}
                onToggleBookmark={onToggleBookmark}
                isReserved={isReserved}
                getSheetNo={getSheetNo}
                isToday={date === today}
                isOnWaitlist={isOnWaitlist}
                onTapLesson={onTapLesson}
                sortReservedFirst={false}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
