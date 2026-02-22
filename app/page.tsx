'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, MapPin, Ticket, AlertTriangle, Bell, RotateCcw, X, Zap, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWaitlist } from '@/hooks/useWaitlist';
import type { WaitlistItem } from '@/hooks/useWaitlist';
import type { ReservationInfo, TicketInfo } from '@/lib/feelcycle-api';
import type { Lesson } from '@/types';
import LessonDetailModal from '@/components/lessons/LessonDetailModal';
import type { ReserveApiResult } from '@/components/lessons/LessonDetailModal';

interface DashboardReservation extends ReservationInfo {
  lessonId?: string | null;
  sidHash?: string | null;
}

interface DashboardData {
  reservations: DashboardReservation[];
  memberSummary: {
    displayName: string;
    membershipType: string;
    totalAttendance: number;
  };
  monthlySubscription: {
    used: number;
    total: number;
    limit: number | null;
    currentMonth: string;
  };
  tickets: TicketInfo[];
}

function formatDateWithDay(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** ReservationInfo → Lesson 変換 */
function reservationToLesson(r: DashboardReservation): Lesson {
  return {
    id: r.lessonId || `${r.date}_${r.startTime}_${r.programName}`,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    programName: r.programName,
    instructor: r.instructor,
    studio: r.studio,
    isFull: true,
    isPast: false,
    availableSlots: 0,
    ticketType: null,
    colorCode: r.bgColor || '#6B7280',
    textColor: r.textColor || '#FFFFFF',
    sidHash: r.sidHash ?? undefined,
  };
}

/** WaitlistItem.lesson → Lesson 変換 */
function waitlistLessonToLesson(entry: WaitlistItem): Lesson | null {
  const l = entry.lesson;
  if (!l) return null;
  return {
    id: l.id,
    date: l.date,
    startTime: l.startTime.slice(0, 5),
    endTime: l.endTime.slice(0, 5),
    programName: l.programName,
    instructor: l.instructor,
    studio: l.studio,
    isFull: l.isFull,
    isPast: false,
    availableSlots: l.availableSlots,
    ticketType: null,
    colorCode: l.colorCode || '#6B7280',
    textColor: l.textColor || '#FFFFFF',
    sidHash: l.sidHash,
  };
}

// --- キャンセル待ちカード（Dialog無し・軽量） ---
function WaitlistCard({
  entry,
  onTapCard,
  onTapRemove,
  onResume,
}: {
  entry: WaitlistItem;
  onTapCard: (entry: WaitlistItem) => void;
  onTapRemove: (entry: WaitlistItem) => void;
  onResume: (lessonId: string) => void;
}) {
  const lesson = entry.lesson;
  if (!lesson) return null;

  return (
    <button
      type="button"
      className="border rounded-lg p-3 space-y-1 w-full text-left cursor-pointer active:bg-accent/50 transition-colors"
      onClick={() => onTapCard(entry)}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">
          {formatDateWithDay(lesson.date)} {lesson.startTime.slice(0, 5)}〜{lesson.endTime.slice(0, 5)}
        </span>
        <span className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {entry.notified ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onResume(entry.lessonId)}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              再開
            </Button>
          ) : entry.autoReserve ? (
            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800">
              <Zap className="h-3 w-3 mr-1" />
              自動予約
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              <Bell className="h-3 w-3 mr-1" />
              監視中
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={() => onTapRemove(entry)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </span>
      </div>
      <div className="text-sm">
        <span
          className="inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-1"
          style={
            lesson.colorCode
              ? { backgroundColor: lesson.colorCode, color: lesson.textColor || '#fff' }
              : {}
          }
        >
          {lesson.programName}
        </span>
        <span className="text-muted-foreground">{lesson.instructor}</span>
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3" />
        {lesson.studio}
        <ChevronRight className="h-3 w-3 ml-auto" />
      </div>
    </button>
  );
}

// --- キャンセル待ちセクション ---
function WaitlistSection({
  entries,
  onResume,
  onTapCard,
  onTapRemove,
}: {
  entries: WaitlistItem[];
  onResume: (lessonId: string) => void;
  onTapCard: (entry: WaitlistItem) => void;
  onTapRemove: (entry: WaitlistItem) => void;
}) {
  const watchingCount = entries.filter((e) => !e.notified).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          キャンセル待ち
          {watchingCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {watchingCount}件監視中
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>キャンセル待ちはありません</p>
            <Button variant="link" className="p-0 h-auto text-sm" asChild>
              <Link href="/lessons">レッスン一覧で登録</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <WaitlistCard
                key={entry.id}
                entry={entry}
                onTapCard={onTapCard}
                onTapRemove={onTapRemove}
                onResume={onResume}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- ログイン済みダッシュボード ---
function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { waitlistEntries, isOnWaitlist, getAutoReserve, addToWaitlist, resumeWaitlist, removeFromWaitlist, toggleAutoReserve } = useWaitlist();

  // モーダル状態
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [hasLineUserId, setHasLineUserId] = useState(false);
  const [modalIsReserved, setModalIsReserved] = useState(false);
  // グループ
  const [groups, setGroups] = useState<Array<{ id: string; name: string; memberCount: number }>>([]);

  // 共有: キャンセル待ち解除ダイアログ
  const [removeTarget, setRemoveTarget] = useState<WaitlistItem | null>(null);

  useEffect(() => {
    // LINE userId 取得
    fetch('/api/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.profile?.lineUserId) setHasLineUserId(true);
      })
      .catch(() => {});
    // グループ一覧取得
    fetch('/api/groups')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.groups) {
          setGroups(data.groups.map((g: { id: string; name: string; memberCount: number }) => ({
            id: g.id, name: g.name, memberCount: g.memberCount,
          })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function fetchDashboard(retried = false): Promise<DashboardData> {
      const res = await fetch('/api/dashboard');
      const body = await res.json();
      if (!res.ok) {
        if (body.code === 'FC_SESSION_EXPIRED' && !retried) {
          const reauthRes = await fetch('/api/auth/feelcycle-reauth', { method: 'POST' });
          if (reauthRes.ok) return fetchDashboard(true);
          throw new Error('FC_NOT_LINKED');
        }
        if (body.code === 'FC_NOT_LINKED') throw new Error('FC_NOT_LINKED');
        throw new Error(body.error || 'データの取得に失敗しました');
      }
      return body;
    }

    fetchDashboard()
      .then(setData)
      .catch((e) => {
        if (e.message === 'FC_NOT_LINKED') {
          window.location.href = '/mypage';
          return;
        } else {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleReserve = useCallback(async (sidHash: string, sheetNo: string): Promise<ReserveApiResult> => {
    const res = await fetch('/api/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sidHash, sheetNo }),
    });
    return res.json();
  }, []);

  const handleInviteGroup = useCallback(async (groupId: string, lesson: Lesson): Promise<{ sent: number; total: number }> => {
    const res = await fetch(`/api/groups/${groupId}/invite-lesson`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programName: lesson.programName,
        date: lesson.date,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        instructor: lesson.instructor,
        studio: lesson.studio,
      }),
    });
    if (!res.ok) throw new Error('Failed to invite');
    return res.json();
  }, []);

  const handleTapReservation = useCallback((r: DashboardReservation) => {
    const lesson = reservationToLesson(r);
    setSelectedLesson(lesson);
    setModalIsReserved(true);
    setModalOpen(true);
  }, []);

  const handleTapWaitlist = useCallback((entry: WaitlistItem) => {
    const lesson = waitlistLessonToLesson(entry);
    if (!lesson) return;
    setSelectedLesson(lesson);
    setModalIsReserved(false);
    setModalOpen(true);
  }, []);

  const handleConfirmRemove = useCallback(() => {
    if (!removeTarget) return;
    removeFromWaitlist(removeTarget.lessonId);
    setRemoveTarget(null);
  }, [removeTarget, removeFromWaitlist]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }


  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <p className="font-medium">エラー</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  // 今日以降の予約のみ（時系列順）
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = data.reservations
    .filter(r => r.date >= today)
    .sort((a, b) => `${a.date}_${a.startTime}`.localeCompare(`${b.date}_${b.startTime}`))
    .slice(0, 5);

  // チケットの期限チェック（14日以内に期限切れ）
  const hasExpiringTickets = data.tickets.some(t =>
    t.details.some(d => {
      const days = daysUntil(d.expiresAt);
      return days >= 0 && days <= 14;
    })
  );

  const sub = data.monthlySubscription;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">
        {data.memberSummary.displayName || 'ダッシュボード'}
      </h1>

      {/* 次の予約 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            予約状況
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">予約はありません</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((r, i) => (
                <button
                  type="button"
                  key={i}
                  className="border rounded-lg p-3 space-y-1 w-full text-left cursor-pointer active:bg-accent/50 transition-colors"
                  onClick={() => handleTapReservation(r)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {formatDateWithDay(r.date)} {r.startTime}〜{r.endTime}
                    </span>
                    <Badge variant="outline">#{r.sheetNo}</Badge>
                  </div>
                  <div className="text-sm">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-xs font-medium mr-1"
                      style={r.bgColor ? { backgroundColor: r.bgColor, color: r.textColor || '#fff' } : {}}
                    >
                      {r.programName}
                    </span>
                    <span className="text-muted-foreground">{r.instructor}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {r.studio}
                    {r.cancelWaitTotal > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        キャン待ち {r.cancelWaitPosition}/{r.cancelWaitTotal}
                      </Badge>
                    )}
                    <ChevronRight className="h-3 w-3 ml-auto" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 空き通知 */}
      <WaitlistSection
        entries={waitlistEntries}
        onResume={resumeWaitlist}
        onTapCard={handleTapWaitlist}
        onTapRemove={setRemoveTarget}
      />

      {/* サブスク残 + チケット */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">今月の受講</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sub.total ?? sub.used}<span className="text-sm font-normal text-muted-foreground">回</span>
            </div>
            {sub.limit != null && (
              <p className="text-xs text-muted-foreground mt-1">
                サブスク残: {sub.limit - sub.used}/{sub.limit}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              累計: {data.memberSummary.totalAttendance}回
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-1">
              <Ticket className="h-4 w-4" />
              チケット
              {hasExpiringTickets && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">なし</p>
            ) : (
              <div className="space-y-2">
                {data.tickets.map((t, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium">{t.name} <span className="text-muted-foreground">{t.totalCount}枚</span></p>
                    {t.details.map((d, j) => {
                      const days = daysUntil(d.expiresAt);
                      const isExpiring = days >= 0 && days <= 14;
                      return (
                        <p key={j} className={`text-xs ${isExpiring ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                          {d.expiresAt}まで {d.count}枚{isExpiring ? ` (あと${days}日)` : ''}
                        </p>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* レッスン詳細モーダル */}
      <LessonDetailModal
        lesson={selectedLesson}
        open={modalOpen}
        onOpenChange={setModalOpen}
        isLoggedIn={true}
        hasLineUserId={hasLineUserId}
        hasFcSession={true}
        isOnWaitlist={selectedLesson ? isOnWaitlist(selectedLesson.id) : false}
        isReserved={modalIsReserved}
        onAddWaitlist={(lesson, autoReserve) => addToWaitlist(lesson, autoReserve)}
        onRemoveWaitlist={removeFromWaitlist}
        onReserve={handleReserve}
        waitlistAutoReserve={selectedLesson ? getAutoReserve(selectedLesson.id) : false}
        onToggleAutoReserve={toggleAutoReserve}
        groups={groups}
        onInviteGroup={handleInviteGroup}
      />

      {/* 共有: キャンセル待ち解除ダイアログ */}
      {removeTarget && (
        <Dialog open onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle>キャンセル待ち解除</DialogTitle>
              <DialogDescription>
                {removeTarget.lesson?.programName}（{removeTarget.lesson && formatDateWithDay(removeTarget.lesson.date)} {removeTarget.lesson?.startTime.slice(0, 5)}）のキャンセル待ちを解除しますか？
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-row gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRemoveTarget(null)}>
                戻る
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleConfirmRemove}>
                解除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// --- 未ログインランディング ---
function Landing() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold mb-3">FEEL hub</h1>
      <p className="text-muted-foreground mb-8">FEELCYCLEライフをもっと快適に</p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button size="lg" asChild>
          <Link href="/login">ログイン</Link>
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
          <Link href="/lessons">ログインせずに使う</Link>
        </Button>
      </div>
    </div>
  );
}

// --- メイン ---
export default function Home() {
  const { user, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return user ? <Dashboard /> : <Landing />;
}
