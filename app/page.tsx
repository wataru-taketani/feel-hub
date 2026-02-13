'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, User, BookOpen, MapPin, Ticket, AlertTriangle, Bell, BellOff, RotateCcw, X } from 'lucide-react';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { useWaitlist } from '@/hooks/useWaitlist';
import type { WaitlistItem } from '@/hooks/useWaitlist';
import type { ReservationInfo, TicketInfo } from '@/lib/feelcycle-api';

interface DashboardData {
  reservations: ReservationInfo[];
  memberSummary: {
    displayName: string;
    membershipType: string;
    totalAttendance: number;
  };
  monthlySubscription: {
    used: number;
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

// --- 空き通知セクション ---
function WaitlistSection({
  entries,
  onResume,
  onRemove,
}: {
  entries: WaitlistItem[];
  onResume: (lessonId: string) => void;
  onRemove: (lessonId: string) => void;
}) {
  const watchingCount = entries.filter((e) => !e.notified).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" />
          空き通知
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
            <p>空き通知はありません</p>
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
                onResume={onResume}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WaitlistCard({
  entry,
  onResume,
  onRemove,
}: {
  entry: WaitlistItem;
  onResume: (lessonId: string) => void;
  onRemove: (lessonId: string) => void;
}) {
  const lesson = entry.lesson;
  if (!lesson) return null;

  return (
    <div
      className={`border rounded-lg p-3 space-y-1 ${
        entry.notified ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {entry.notified ? (
            <BellOff className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Bell className="h-4 w-4 shrink-0 text-orange-500" />
          )}
          <span
            className="inline-block px-1.5 py-0.5 rounded text-xs font-medium truncate"
            style={
              lesson.colorCode
                ? { backgroundColor: lesson.colorCode, color: lesson.textColor || '#fff' }
                : {}
            }
          >
            {lesson.programName}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {lesson.studio}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
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
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => onRemove(entry.lessonId)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
        <span>
          {formatDateWithDay(lesson.date)} {lesson.startTime}〜{lesson.endTime}
        </span>
        <span>/ {lesson.instructor}</span>
      </div>
      {entry.notified && (
        <div className="text-xs text-muted-foreground pl-6">通知済み</div>
      )}
    </div>
  );
}

// --- ログイン済みダッシュボード ---
function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { waitlistEntries, resumeWaitlist, removeFromWaitlist } = useWaitlist();

  useEffect(() => {
    fetch('/api/dashboard')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || 'データの取得に失敗しました');
        }
        return res.json();
      })
      .then(setData)
      .catch((e) => {
        const msg = e.message;
        const isSessionError = msg.includes('セッション') || msg.includes('再ログイン') || msg.includes('未認証');
        if (isSessionError) {
          createSupabaseClient().auth.signOut();
        }
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

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
    const isSession = error.includes('セッション') || error.includes('再ログイン') || error.includes('未認証');
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <p className="font-medium">{isSession ? 'セッションが切れました' : 'エラー'}</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            {isSession && (
              <Button asChild><Link href="/login">再ログイン</Link></Button>
            )}
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
            次の予約
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">予約はありません</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((r, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-1">
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 空き通知 */}
      <WaitlistSection
        entries={waitlistEntries}
        onResume={resumeWaitlist}
        onRemove={removeFromWaitlist}
      />

      {/* サブスク残 + チケット */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">今月の受講</CardTitle>
          </CardHeader>
          <CardContent>
            {sub.limit != null ? (
              <>
                <div className="text-2xl font-bold">
                  残 {sub.limit - sub.used}<span className="text-sm font-normal text-muted-foreground">/{sub.limit}回</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  サブスク利用: {sub.used}回
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold">
                {sub.used}<span className="text-sm font-normal text-muted-foreground">回</span>
              </div>
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

      {/* クイックリンク */}
      <div className="grid grid-cols-3 gap-3">
        <Button variant="outline" className="h-auto py-3 justify-start" asChild>
          <Link href="/lessons">
            <CalendarDays className="h-4 w-4 mr-2" />
            レッスン一覧
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 justify-start" asChild>
          <Link href="/mypage">
            <User className="h-4 w-4 mr-2" />
            マイページ
          </Link>
        </Button>
        <Button variant="outline" className="h-auto py-3 justify-start" asChild>
          <Link href="/history">
            <BookOpen className="h-4 w-4 mr-2" />
            受講履歴
          </Link>
        </Button>
      </div>
    </div>
  );
}

// --- 未ログインランディング ---
function Landing() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold mb-3">Feel Hub</h1>
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
