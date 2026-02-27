'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import type { Lesson } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, BellOff, Clock, MapPin, Users, LogIn, Zap, Loader2, CheckCircle, AlertTriangle, ChevronDown, Send, CalendarPlus, ArrowRightLeft } from 'lucide-react';
import { formatStudio, formatDate, parseHomeStoreToStudio } from '@/lib/lessonUtils';
import { downloadICS } from '@/lib/calendarUtils';

const SeatMap = lazy(() => import('@/components/lessons/SeatMap'));

export interface ReserveApiResult {
  success: boolean;
  resultCode: number;
  message: string;
  sheetNo?: string;
  needsManualConfirm?: boolean;
  confirmReason?: string;
}

interface GroupInfo {
  id: string;
  name: string;
  memberCount: number;
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
  onAddWaitlist: (lesson: Lesson, autoReserve?: boolean, preferredSeats?: string[]) => void;
  onRemoveWaitlist: (lessonId: string) => void;
  onReserve?: (sidHash: string, sheetNo: string) => Promise<ReserveApiResult>;
  waitlistAutoReserve?: boolean;
  onToggleAutoReserve?: (lessonId: string) => void;
  waitlistPreferredSeats?: string[] | null;
  onSetPreferredSeats?: (lessonId: string, seats: string[] | null) => void;
  groups?: GroupInfo[];
  onInviteGroup?: (groupId: string, lesson: Lesson) => Promise<{ sent: number; total: number }>;
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
  waitlistPreferredSeats,
  onSetPreferredSeats,
  groups,
  onInviteGroup,
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
  // お気に入り席
  const [preferredSeats, setPreferredSeats] = useState<string[]>([]);
  // バイク指定モード（自動予約時のバイク選択）
  const [showBikeSelect, setShowBikeSelect] = useState(false);
  const [bikeSelectSeats, setBikeSelectSeats] = useState<string[]>([]);
  // 手動振替（予約済み→空席タップ→振替）
  const [transferSeat, setTransferSeat] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferResult, setTransferResult] = useState<ReserveApiResult | null>(null);
  // 自動振替（予約済み→指定席で自動振替設定）
  const [showAutoTransfer, setShowAutoTransfer] = useState(false);
  const [autoTransferSeats, setAutoTransferSeats] = useState<string[]>([]);
  // グループ誘い機能
  const [inviteStep, setInviteStep] = useState<'idle' | 'select' | 'confirm' | 'sending' | 'done'>('idle');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{ sent: number; total: number } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // モーダル表示時にお気に入り席を取得
  useEffect(() => {
    if (!open || !lesson || !hasFcSession) return;
    setPreferredSeats([]);
    // FC API形式 "銀座（GNZ）" → DB形式 "銀座" に正規化
    const studioKey = parseHomeStoreToStudio(lesson.studio);
    fetch(`/api/seat-preferences?studio=${encodeURIComponent(studioKey)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.preferences?.[studioKey]) {
          setPreferredSeats(data.preferences[studioKey]);
        }
      })
      .catch(() => {});
  }, [open, lesson?.id, lesson?.studio, hasFcSession]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleTransfer = async () => {
    if (!onReserve || !lesson.sidHash || !transferSeat) return;
    setTransferring(true);
    setTransferResult(null);
    try {
      const result = await onReserve(lesson.sidHash, transferSeat);
      setTransferResult(result);
      if (result.success) {
        setTransferSeat(null);
      }
    } catch {
      setTransferResult({ success: false, resultCode: -1, message: '通信エラーが発生しました' });
    } finally {
      setTransferring(false);
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
      setPreferredSeats([]);
      setShowBikeSelect(false);
      setBikeSelectSeats([]);
      setTransferSeat(null);
      setTransferring(false);
      setTransferResult(null);
      setShowAutoTransfer(false);
      setAutoTransferSeats([]);
      setInviteStep('idle');
      setSelectedGroupId(null);
      setInviteResult(null);
      setInviteError(null);
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
                  <span className="text-sm text-green-700 font-medium">残り {effectiveAvailableSlots} 席</span>
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

        {/* カレンダーに追加 */}
        {!lesson.isPast && (
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => downloadICS(lesson)}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              カレンダーに追加
            </Button>
          </div>
        )}

        {/* グループ誘い機能（予約済み + グループ所属時） */}
        {isReserved && groups && groups.length > 0 && onInviteGroup && (
          <div className="pt-2 border-t">
            {inviteStep === 'idle' && !inviteResult && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (groups.length === 1) {
                    setSelectedGroupId(groups[0].id);
                    setInviteStep('confirm');
                  } else {
                    setSelectedGroupId(groups[0].id);
                    setInviteStep('select');
                  }
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                グループメンバーを誘う
              </Button>
            )}

            {inviteStep === 'select' && (
              <div className="space-y-3">
                <p className="text-sm font-medium">通知するグループを選択</p>
                <div className="space-y-2">
                  {groups.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-center gap-3 p-2 rounded-lg border cursor-pointer active:bg-accent/50"
                    >
                      <input
                        type="radio"
                        name="invite-group"
                        checked={selectedGroupId === g.id}
                        onChange={() => setSelectedGroupId(g.id)}
                        className="accent-primary"
                      />
                      <span className="text-sm flex-1">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{g.memberCount}人</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setInviteStep('idle');
                      setSelectedGroupId(null);
                    }}
                  >
                    戻る
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => setInviteStep('confirm')}
                    disabled={!selectedGroupId}
                  >
                    次へ
                  </Button>
                </div>
              </div>
            )}

            {inviteStep === 'confirm' && selectedGroupId && (
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">
                  {groups.find((g) => g.id === selectedGroupId)?.name}のメンバーに通知しますか？
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      if (groups.length === 1) {
                        setInviteStep('idle');
                        setSelectedGroupId(null);
                      } else {
                        setInviteStep('select');
                      }
                    }}
                  >
                    戻る
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={async () => {
                      setInviteStep('sending');
                      setInviteError(null);
                      try {
                        const result = await onInviteGroup(selectedGroupId, lesson);
                        setInviteResult(result);
                        setInviteStep('done');
                      } catch {
                        setInviteError('通知の送信に失敗しました');
                        setInviteStep('idle');
                        setSelectedGroupId(null);
                      }
                    }}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    送信
                  </Button>
                </div>
              </div>
            )}

            {inviteStep === 'sending' && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">送信中...</span>
              </div>
            )}

            {inviteResult && (
              <div className="p-3 rounded-lg text-sm bg-green-50 text-green-800 border border-green-200">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{inviteResult.sent}人に通知しました{inviteResult.sent < inviteResult.total ? `（LINE未連携: ${inviteResult.total - inviteResult.sent}人）` : ''}</span>
                </div>
              </div>
            )}

            {inviteError && (
              <div className="p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{inviteError}</span>
                </div>
              </div>
            )}
          </div>
        )}

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
                preferredSeats={preferredSeats}
              />
            </Suspense>

            {selectedSeat && !showConfirm && (
              <Button
                className="w-full mt-3"
                size="sm"
                onClick={() => setShowConfirm(true)}
                disabled={reserving}
              >
                バイク #{selectedSeat} を予約する
              </Button>
            )}

            {showConfirm && (
              <div className="mt-3 p-3 bg-muted rounded-lg space-y-2">
                <p className="text-sm font-medium">バイク #{selectedSeat} を予約しますか？</p>
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
              {/* バイク指定（自動予約ON時のみ） */}
              {hasFcSession && waitlistAutoReserve && onSetPreferredSeats && lesson.sidHash && (
                <div className="space-y-2">
                  {waitlistPreferredSeats && waitlistPreferredSeats.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        指定バイク: {waitlistPreferredSeats.map(s => `#${s}`).join(', ')}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => {
                          setBikeSelectSeats(waitlistPreferredSeats);
                          setShowBikeSelect(!showBikeSelect);
                        }}
                      >
                        バイク指定を変更
                        <ChevronDown className={`h-3.5 w-3.5 ml-1 transition-transform ${showBikeSelect ? 'rotate-180' : ''}`} />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        setBikeSelectSeats([]);
                        setShowBikeSelect(!showBikeSelect);
                      }}
                    >
                      バイク指定
                      <ChevronDown className={`h-3.5 w-3.5 ml-1 transition-transform ${showBikeSelect ? 'rotate-180' : ''}`} />
                    </Button>
                  )}
                  {showBikeSelect && (
                    <div className="space-y-2">
                      <Suspense fallback={<Skeleton className="w-full h-48 rounded-lg" />}>
                        <SeatMap
                          sidHash={lesson.sidHash}
                          multiSelect
                          selectedSeats={bikeSelectSeats}
                          onSelectedSeatsChange={setBikeSelectSeats}
                          onDataLoaded={(avail, total) => setRealAvailable({ available: avail, total })}
                          preferredSeats={preferredSeats}
                        />
                      </Suspense>
                      <div className="flex gap-2">
                        {waitlistPreferredSeats && waitlistPreferredSeats.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              onSetPreferredSeats(lesson.id, null);
                              setShowBikeSelect(false);
                              setBikeSelectSeats([]);
                            }}
                          >
                            指定解除
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={bikeSelectSeats.length === 0}
                          onClick={() => {
                            onSetPreferredSeats(lesson.id, bikeSelectSeats);
                            setShowBikeSelect(false);
                          }}
                        >
                          決定
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
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
                    onChange={(e) => {
                      setAutoReserve(e.target.checked);
                      if (!e.target.checked) {
                        setShowBikeSelect(false);
                        setBikeSelectSeats([]);
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  空きが出たら自動予約する
                </label>
              )}
              {/* バイク指定（自動予約ON時のみ） */}
              {hasFcSession && autoReserve && lesson.sidHash && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      setBikeSelectSeats([]);
                      setShowBikeSelect(!showBikeSelect);
                    }}
                  >
                    バイク指定
                    <ChevronDown className={`h-3.5 w-3.5 ml-1 transition-transform ${showBikeSelect ? 'rotate-180' : ''}`} />
                  </Button>
                  {showBikeSelect && (
                    <Suspense fallback={<Skeleton className="w-full h-48 rounded-lg" />}>
                      <SeatMap
                        sidHash={lesson.sidHash}
                        multiSelect
                        selectedSeats={bikeSelectSeats}
                        onSelectedSeatsChange={setBikeSelectSeats}
                        onDataLoaded={(avail, total) => setRealAvailable({ available: avail, total })}
                        preferredSeats={preferredSeats}
                      />
                    </Suspense>
                  )}
                  {showBikeSelect && bikeSelectSeats.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      選択中: {bikeSelectSeats.sort((a, b) => Number(a) - Number(b)).map(s => `#${s}`).join(', ')}
                    </p>
                  )}
                </div>
              )}
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  const seats = showBikeSelect && bikeSelectSeats.length > 0 ? bikeSelectSeats : undefined;
                  onAddWaitlist(lesson, autoReserve, seats);
                  setAutoReserve(false);
                  setShowBikeSelect(false);
                  setBikeSelectSeats([]);
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

        {/* 座席マップセクション（予約済み: 手動振替 + 自動振替 / 満席: 閲覧のみ） */}
        {!lesson.isPast && lesson.sidHash && hasFcSession && !canReserve && (
          <div className="pt-2 border-t">
            {showReadOnlySeatMap ? (
              <div className="space-y-2">
                <Suspense fallback={<Skeleton className="w-full h-48 rounded-lg" />}>
                  <SeatMap
                    sidHash={lesson.sidHash}
                    interactive={isReserved && !!onReserve}
                    selectedSeat={transferSeat}
                    onSeatSelect={(seat) => setTransferSeat(seat)}
                    onDataLoaded={(avail, total) => setRealAvailable({ available: avail, total })}
                    preferredSeats={preferredSeats}
                    refreshKey={seatMapRefreshKey}
                  />
                </Suspense>

                {/* 手動振替: 空席をタップ → 確認ボタン */}
                {isReserved && onReserve && transferSeat && !transferResult?.success && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <p className="text-sm font-medium">バイク #{transferSeat} に振替しますか？</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setTransferSeat(null)}
                        disabled={transferring}
                      >
                        戻る
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={handleTransfer}
                        disabled={transferring}
                      >
                        {transferring ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowRightLeft className="h-4 w-4 mr-1" />}
                        振替する
                      </Button>
                    </div>
                  </div>
                )}

                {/* 振替結果表示 */}
                {transferResult && (
                  <div className={`p-3 rounded-lg text-sm ${transferResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    <div className="flex items-start gap-2">
                      {transferResult.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                      <span>{transferResult.message}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => setShowReadOnlySeatMap(true)}
              >
                バイクマップを表示
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        )}

        {/* 自動振替セクション（予約済み + FCセッションあり + LINE連携済み） */}
        {isReserved && !lesson.isPast && lesson.sidHash && hasFcSession && hasLineUserId && isLoggedIn && onSetPreferredSeats && (
          <div className="pt-2 border-t">
            {(() => {
              const hasAutoTransfer = isOnWaitlist && waitlistAutoReserve && waitlistPreferredSeats && waitlistPreferredSeats.length > 0;
              if (hasAutoTransfer) {
                return (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      自動振替設定済み: {waitlistPreferredSeats!.map(s => `#${s}`).join(', ')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        onRemoveWaitlist(lesson.id);
                      }}
                    >
                      <BellOff className="h-4 w-4 mr-2" />
                      自動振替を解除する
                    </Button>
                  </div>
                );
              }
              return (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => {
                      setAutoTransferSeats([]);
                      setShowAutoTransfer(!showAutoTransfer);
                    }}
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                    空いたら自動振替する
                    <ChevronDown className={`h-3.5 w-3.5 ml-1 transition-transform ${showAutoTransfer ? 'rotate-180' : ''}`} />
                  </Button>
                  {showAutoTransfer && (
                    <div className="space-y-2">
                      <Suspense fallback={<Skeleton className="w-full h-48 rounded-lg" />}>
                        <SeatMap
                          sidHash={lesson.sidHash!}
                          multiSelect
                          selectedSeats={autoTransferSeats}
                          onSelectedSeatsChange={setAutoTransferSeats}
                          preferredSeats={preferredSeats}
                        />
                      </Suspense>
                      {autoTransferSeats.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          選択中: {autoTransferSeats.sort((a, b) => Number(a) - Number(b)).map(s => `#${s}`).join(', ')}
                        </p>
                      )}
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={autoTransferSeats.length === 0}
                        onClick={() => {
                          onAddWaitlist(lesson, true, autoTransferSeats);
                          setShowAutoTransfer(false);
                          setAutoTransferSeats([]);
                        }}
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        設定する
                      </Button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
