'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import type { Lesson } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, BellOff, Clock, MapPin, Users, LogIn, Zap, Loader2, CheckCircle, AlertTriangle, ChevronDown } from 'lucide-react';
import { formatStudio, formatDate } from '@/lib/lessonUtils';

const SeatMap = lazy(() => import('@/components/lessons/SeatMap'));

export interface ReserveApiResult {
  success: boolean;
  resultCode: number;
  message: string;
  sheetNo?: string;
  needsManualConfirm?: boolean;
  confirmReason?: string;
}

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
  onReserve?: (sidHash: string, sheetNo: string) => Promise<ReserveApiResult>;
  waitlistAutoReserve?: boolean;
  onToggleAutoReserve?: (lessonId: string) => void;
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
  onReserve,
  waitlistAutoReserve,
  onToggleAutoReserve,
}: LessonDetailModalProps) {
  const [autoReserve, setAutoReserve] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [reserving, setReserving] = useState(false);
  const [reserveResult, setReserveResult] = useState<ReserveApiResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [seatMapRefreshKey, setSeatMapRefreshKey] = useState(0);
  const [showReadOnlySeatMap, setShowReadOnlySeatMap] = useState(false);
  // 座席マップから取得したリアルタイム空き状況（DB値を上書き）
  const [realAvailable, setRealAvailable] = useState<{ available: number; total: number } | null>(null);

  // DB上「満席」の場合、モーダル表示時に座席APIでリアルタイム確認
  useEffect(() => {
    if (!open || !lesson || !lesson.isFull || !lesson.sidHash || !hasFcSession || lesson.isPast) return;
    setRealAvailable(null);
    fetch(`/api/seatmap?sidHash=${encodeURIComponent(lesson.sidHash)}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (!json?.bikes) return;
        const entries = Object.values(json.bikes) as { status: number }[];
        setRealAvailable({
          available: entries.filter(b => b.status === 1).length,
          total: entries.length,
        });
      })
      .catch(() => {});
  }, [open, lesson?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!lesson || !open) return null;

  // リアルタイム空き情報があればそちらを優先
  const effectiveIsFull = realAvailable ? realAvailable.available === 0 : lesson.isFull;
  const effectiveAvailableSlots = realAvailable ? realAvailable.available : lesson.availableSlots;

  const canNotify = !isReserved && !lesson.isPast && effectiveIsFull;
  const canReserve = !isReserved && !lesson.isPast && !effectiveIsFull && hasFcSession && lesson.sidHash && onReserve;

  const handleReserve = async () => {
    if (!onReserve || !lesson.sidHash || !selectedSeat) return;
    setShowConfirm(false);
    setReserving(true);
    setReserveResult(null);
    try {
      const result = await onReserve(lesson.sidHash, selectedSeat);
      setReserveResult(result);
      if (result.resultCode === 205) {
        // 競合: SeatMapリフレッシュ
        setSelectedSeat(null);
        setSeatMapRefreshKey(k => k + 1);
      }
      if (result.success) {
        setSelectedSeat(null);
      }
    } catch {
      setReserveResult({ success: false, resultCode: -1, message: '通信エラーが発生しました' });
    } finally {
      setReserving(false);
    }
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) {
      // reset state on close
      setSelectedSeat(null);
      setReserveResult(null);
      setShowConfirm(false);
      setReserving(false);
      setShowReadOnlySeatMap(false);
      setRealAvailable(null);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
                {effectiveIsFull ? (
                  <Badge variant="destructive" className="text-xs">満席</Badge>
                ) : (
                  <span className="text-green-700 font-medium">残り {effectiveAvailableSlots} 席</span>
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

        {/* 予約結果表示 */}
        {reserveResult && (
          <div className={`p-3 rounded-lg text-sm ${reserveResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            <div className="flex items-start gap-2">
              {reserveResult.success ? (
                <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>{reserveResult.message}</span>
            </div>
          </div>
        )}

        {/* 手動予約セクション（空席あり + 未予約 + FCセッションあり） */}
        {canReserve && !reserveResult?.success && (
          <div className="pt-2 border-t">
            <Suspense fallback={<Skeleton className="w-full h-48 rounded-lg" />}>
              <SeatMap
                sidHash={lesson.sidHash!}
                interactive
                selectedSeat={selectedSeat}
                onSeatSelect={setSelectedSeat}
                refreshKey={seatMapRefreshKey}
                onDataLoaded={(avail, total) => setRealAvailable({ available: avail, total })}
              />
            </Suspense>

            {selectedSeat && !showConfirm && (
              <Button
                className="w-full mt-3"
                size="sm"
                onClick={() => setShowConfirm(true)}
                disabled={reserving}
              >
                座席 #{selectedSeat} を予約する
              </Button>
            )}

            {showConfirm && (
              <div className="mt-3 p-3 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">座席 #{selectedSeat} を予約しますか？</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowConfirm(false)}
                    disabled={reserving}
                  >
                    戻る
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleReserve}
                    disabled={reserving}
                  >
                    {reserving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    予約する
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

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
            ) : isReserved || reserveResult?.success ? (
              <p className="text-sm text-muted-foreground">このレッスンは予約済みです</p>
            ) : !effectiveIsFull ? (
              !canReserve ? (
                <p className="text-sm text-muted-foreground">空席があります</p>
              ) : null
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
            <div className="space-y-2">
              {hasFcSession && onToggleAutoReserve && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!waitlistAutoReserve}
                    onChange={() => onToggleAutoReserve(lesson.id)}
                    className="rounded border-gray-300"
                  />
                  <Zap className={`h-3.5 w-3.5 ${waitlistAutoReserve ? 'text-amber-500' : 'text-muted-foreground'}`} />
                  空きが出たら自動予約する
                </label>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  onRemoveWaitlist(lesson.id);
                  handleOpenChange(false);
                }}
              >
                <BellOff className="h-4 w-4 mr-2" />
                通知登録済み（解除する）
              </Button>
            </div>
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
                  handleOpenChange(false);
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

        {/* 座席マップセクション（閲覧のみ: 満席 or 予約済みの場合） */}
        {!lesson.isPast && lesson.sidHash && hasFcSession && !canReserve && (
          <div className="pt-2 border-t">
            {showReadOnlySeatMap ? (
              <Suspense fallback={<Skeleton className="w-full h-48 rounded-lg" />}>
                <SeatMap
                  sidHash={lesson.sidHash}
                  onDataLoaded={(avail, total) => setRealAvailable({ available: avail, total })}
                />
              </Suspense>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setShowReadOnlySeatMap(true)}
              >
                座席マップを表示
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
