'use client';

import { useState } from 'react';
import type { Lesson } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Clock, MapPin, Users, LogIn, Zap } from 'lucide-react';
import { formatStudio, formatDate } from '@/lib/lessonUtils';
import SeatMap from '@/components/lessons/SeatMap';

interface LessonDetailModalProps {
  lesson: Lesson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLoggedIn: boolean;
  hasLineUserId: boolean;
  hasFcSession: boolean;
  isOnWaitlist: boolean;
  isReserved: boolean;
  onAddWaitlist: (lesson: Lesson, autoReserve?: boolean) => void;
  onRemoveWaitlist: (lessonId: string) => void;
}

export default function LessonDetailModal({
  lesson,
  open,
  onOpenChange,
  isLoggedIn,
  hasLineUserId,
  hasFcSession,
  isOnWaitlist,
  isReserved,
  onAddWaitlist,
  onRemoveWaitlist,
}: LessonDetailModalProps) {
  const [autoReserve, setAutoReserve] = useState(false);

  if (!lesson) return null;

  const canNotify = !isReserved && !lesson.isPast && lesson.isFull;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="inline-block px-2 py-0.5 rounded text-sm font-bold"
              style={{ backgroundColor: lesson.colorCode || '#6B7280', color: lesson.textColor || '#FFFFFF' }}
            >
              {lesson.programName}
            </span>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{formatDate(lesson.date)} {lesson.startTime}–{lesson.endTime}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <span className="text-muted-foreground shrink-0 w-4 text-center font-medium">IR</span>
                <span>{lesson.instructor}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{formatStudio(lesson.studio)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                {lesson.isFull ? (
                  <Badge variant="destructive" className="text-xs">満席</Badge>
                ) : (
                  <span className="text-green-700 font-medium">残り {lesson.availableSlots} 席</span>
                )}
              </div>
              {isReserved && (
                <Badge className="bg-red-500 text-white text-xs">予約済み</Badge>
              )}
              {lesson.ticketType && (
                <Badge variant="outline" className="text-xs">
                  {lesson.ticketType === 'PLATINUM' ? 'PLATINUM' : lesson.ticketType === 'GOLD' ? 'GOLD' : lesson.ticketType === 'SILVER' ? 'SILVER' : 'WHITE'} チケット
                </Badge>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* 空き通知セクション */}
        <div className="pt-2 border-t">
          {!isLoggedIn ? (
            <p className="text-sm text-muted-foreground">
              <LogIn className="h-4 w-4 inline mr-1" />
              空き通知を利用するにはログインしてください
            </p>
          ) : !canNotify ? (
            lesson.isPast ? (
              <p className="text-sm text-muted-foreground">このレッスンは終了しました</p>
            ) : isReserved ? (
              <p className="text-sm text-muted-foreground">このレッスンは予約済みです</p>
            ) : !lesson.isFull ? (
              <p className="text-sm text-muted-foreground">空席があります</p>
            ) : null
          ) : !hasLineUserId ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                空き通知にはLINE連携が必要です
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href="/mypage">マイページでLINEを設定</a>
              </Button>
            </div>
          ) : isOnWaitlist ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                onRemoveWaitlist(lesson.id);
                onOpenChange(false);
              }}
            >
              <BellOff className="h-4 w-4 mr-2" />
              通知登録済み（解除する）
            </Button>
          ) : (
            <div className="space-y-2">
              {hasFcSession && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReserve}
                    onChange={(e) => setAutoReserve(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  空きが出たら自動予約する
                </label>
              )}
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  onAddWaitlist(lesson, autoReserve);
                  setAutoReserve(false);
                  onOpenChange(false);
                }}
              >
                {autoReserve ? (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    自動予約を設定する
                  </>
                ) : (
                  <>
                    <Bell className="h-4 w-4 mr-2" />
                    空き通知を受け取る
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* 座席マップセクション */}
        {!lesson.isPast && lesson.sidHash && hasFcSession && (
          <div className="pt-2 border-t">
            <SeatMap sidHash={lesson.sidHash} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
