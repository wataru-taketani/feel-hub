'use client';

import { memo } from 'react';
import type { Lesson } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatStudio } from '@/lib/lessonUtils';

interface LessonCardProps {
  lesson: Lesson;
  isBookmarked: boolean;
  onToggleBookmark: (lesson: Lesson) => void;
  isReserved?: boolean;
  sheetNo?: string | null;
  isOnWaitlist?: boolean;
  onTapLesson?: (lesson: Lesson) => void;
}

export default memo(function LessonCard({ lesson, isBookmarked, onToggleBookmark, isReserved, sheetNo, isOnWaitlist, onTapLesson }: LessonCardProps) {
  const { startTime, endTime, programName, instructor, studio, isFull, isPast, availableSlots, ticketType, colorCode, textColor } = lesson;

  const grayed = isFull && !isPast && !isReserved;

  return (
    <div
      className={cn(
        'group relative h-[88px] px-2.5 py-1.5 border-b border-border last:border-b-0 transition-colors',
        isPast ? 'bg-muted/60' : grayed ? 'bg-muted' : isReserved ? 'ring-2 ring-inset ring-red-500 bg-[#f6dcdc]' : 'active:bg-accent/30',
        onTapLesson && 'cursor-pointer'
      )}
      onClick={() => onTapLesson?.(lesson)}
    >
      {/* ブックマーク（右上） */}
      <Button
        variant="ghost"
        size="icon"
        className={cn('absolute -top-0.5 -right-0.5 h-8 w-8 transition-all z-10 active:scale-125', isReserved || isBookmarked ? 'opacity-80' : 'opacity-50')}
        onClick={(e) => {
          e.stopPropagation();
          onToggleBookmark(lesson);
        }}
        aria-label={isBookmarked ? 'ブックマーク解除' : 'ブックマーク追加'}
      >
        <Star className={cn('h-3.5 w-3.5', isBookmarked ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
      </Button>

      {/* ウェイトリスト登録済みベル */}
      {isOnWaitlist && (
        <Bell className="absolute top-1 right-7 h-3 w-3 text-orange-500 fill-orange-500 z-10" />
      )}

      {/* 時間 */}
      <div className={cn('text-[11px] font-medium tracking-wide tabular-nums', 'text-muted-foreground')}>
        {startTime}–{endTime}
      </div>

      {/* プログラム名（背景色付き） */}
      <div
        className="rounded px-1.5 py-px text-[11px] font-bold truncate mt-0.5"
        style={grayed
          ? { backgroundColor: '#D1D5DB', color: '#9CA3AF' }
          : { backgroundColor: colorCode || '#6B7280', color: textColor || '#FFFFFF' }
        }
        title={programName}
      >
        {programName}
      </div>

      {/* IR名 + バイク番号 */}
      <div className={cn('text-[11px] font-medium mt-0.5 flex items-center justify-between', grayed ? 'text-muted-foreground' : 'text-foreground/80')}>
        <span className="truncate">{instructor}</span>
        {isReserved && sheetNo && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0 ml-1">
            #{sheetNo}
          </Badge>
        )}
      </div>

      {/* スタジオ + 残席 + チケット種類 */}
      <div className="flex items-center justify-between mt-0.5">
        <span className={cn('text-[10px] font-semibold truncate', grayed ? 'text-muted-foreground' : 'text-foreground/60')}>
          {formatStudio(studio)}
          {ticketType && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 ml-1 inline-flex align-middle bg-white/80">
              {ticketType === 'PLATINUM' ? 'PT' : ticketType === 'GOLD' ? 'GD' : ticketType === 'SILVER' ? 'SV' : 'WH'}
            </Badge>
          )}
        </span>
        {isFull ? (
          <span className="text-[10px] font-semibold text-muted-foreground shrink-0">✕</span>
        ) : (
          <span className="text-[10px] font-bold text-green-700 tabular-nums shrink-0">{availableSlots}</span>
        )}
      </div>
    </div>
  );
})
