'use client';

import type { Lesson } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatStudio } from '@/lib/lessonUtils';

interface LessonCardProps {
  lesson: Lesson;
  isBookmarked: boolean;
  onToggleBookmark: (lesson: Lesson) => void;
  isReserved?: boolean;
}

export default function LessonCard({ lesson, isBookmarked, onToggleBookmark, isReserved }: LessonCardProps) {
  const { startTime, endTime, programName, instructor, studio, isFull, isPast, availableSlots, ticketType, colorCode, textColor } = lesson;

  const grayed = isFull && !isPast && !isReserved;

  return (
    <div
      className={cn(
        'group relative h-[88px] px-2.5 py-1.5 border-b border-border last:border-b-0 transition-colors',
        isPast && 'opacity-35',
        grayed ? 'bg-muted' : isReserved ? 'ring-2 ring-inset ring-red-500 bg-[#f6dcdc]' : 'hover:bg-accent/50'
      )}
    >
      {/* ブックマーク（右上） */}
      <Button
        variant="ghost"
        size="icon"
        className={cn('absolute top-0.5 right-0.5 h-6 w-6 transition-opacity z-10', isReserved ? 'opacity-80' : 'opacity-50 group-hover:opacity-100')}
        onClick={(e) => {
          e.stopPropagation();
          onToggleBookmark(lesson);
        }}
        aria-label={isBookmarked ? 'ブックマーク解除' : 'ブックマーク追加'}
      >
        <Star className={cn('h-3.5 w-3.5', isBookmarked ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground')} />
      </Button>

      {/* 時間 */}
      <div className={cn('text-[11px] font-medium tracking-wide tabular-nums', grayed ? 'text-muted-foreground/70' : 'text-muted-foreground')}>
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

      {/* IR名 */}
      <div className={cn('text-[11px] font-medium mt-0.5 truncate', grayed ? 'text-muted-foreground/60' : 'text-foreground/80')}>
        {instructor}
      </div>

      {/* スタジオ + 残席 + チケット種類 */}
      <div className="flex items-center justify-between mt-0.5">
        <span className={cn('text-[10px] font-semibold truncate', grayed ? 'text-muted-foreground/50' : 'text-foreground/60')}>
          {formatStudio(studio)}
          {ticketType && (
            <Badge variant="outline" className={cn('text-[10px] px-1 py-0 h-4 ml-1 inline-flex align-middle bg-white/80', grayed && 'opacity-50')}>
              {ticketType === 'PLATINUM' ? 'PT' : ticketType === 'GOLD' ? 'GD' : ticketType === 'SILVER' ? 'SV' : 'WH'}
            </Badge>
          )}
        </span>
        {isFull ? (
          <span className="text-[10px] font-semibold text-muted-foreground/60 shrink-0">✕</span>
        ) : (
          <span className="text-[10px] font-bold text-green-700 tabular-nums shrink-0">{availableSlots}</span>
        )}
      </div>
    </div>
  );
}
