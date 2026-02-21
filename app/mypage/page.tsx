'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LinkIcon, MapPin, Ticket, User, Loader2, Save, RefreshCw, Bell, BellOff } from 'lucide-react';
import type { MypageInfo, ReservationInfo, TicketInfo } from '@/lib/feelcycle-api';
import type { AttendanceRecord } from '@/types';
import StudioTab from '@/components/mypage/StudioTab';

type ProgramColorMap = Record<string, { colorCode: string; textColor: string }>;

interface MypageData {
  mypage: MypageInfo;
  reservations: ReservationInfo[];
  tickets: TicketInfo[];
}

export default function MypagePage() {
  return (
    <Suspense fallback={
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    }>
      <MypageContent />
    </Suspense>
  );
}

function MypageContent() {
  const [data, setData] = useState<MypageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fcNotLinked, setFcNotLinked] = useState(false);

  // FEELCYCLE連携フォーム
  const [fcEmail, setFcEmail] = useState('');
  const [fcPassword, setFcPassword] = useState('');
  const [fcLinking, setFcLinking] = useState(false);
  const [fcLinkError, setFcLinkError] = useState<string | null>(null);

  // 入会年月設定
  const [joinedYear, setJoinedYear] = useState('');
  const [joinedMonth, setJoinedMonth] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // LINE通知
  const [lineLinked, setLineLinked] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  // 履歴タブ
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [programColors, setProgramColors] = useState<ProgramColorMap>({});

  // マイページデータ取得（自動再認証対応）
  const fetchMypage = useCallback(async (retried = false): Promise<MypageData> => {
    const res = await fetch('/api/mypage');
    const body = await res.json();

    if (!res.ok) {
      // セッション期限切れ → 自動再認証を試みる
      if (body.code === 'FC_SESSION_EXPIRED' && !retried) {
        const reauthRes = await fetch('/api/auth/feelcycle-reauth', { method: 'POST' });
        if (reauthRes.ok) {
          return fetchMypage(true);
        }
        // 再認証失敗 → 再連携が必要
        throw new Error('FC_NOT_LINKED');
      }
      if (body.code === 'FC_NOT_LINKED') {
        throw new Error('FC_NOT_LINKED');
      }
      throw new Error(body.error || 'データの取得に失敗しました');
    }

    return body;
  }, []);

  useEffect(() => {
    const profileFetch = fetch('/api/profile').then((res) => res.json()).catch(() => null);
    const programsFetch = fetch('/api/programs').then((res) => res.json()).catch(() => ({}));

    Promise.all([fetchMypage(), profileFetch, programsFetch])
      .then(([mypageData, profileData, programsData]) => {
        setData(mypageData);
        setError(null);
        setFcNotLinked(false);

        if (profileData?.profile?.joinedAt) {
          const [y, m] = profileData.profile.joinedAt.split('-');
          setJoinedYear(y);
          setJoinedMonth(m);
        }
        if (profileData?.profile?.lineUserId) {
          setLineLinked(true);
        }

        setProgramColors(programsData);
      })
      .catch((e) => {
        if (e.message === 'FC_NOT_LINKED') {
          setFcNotLinked(true);
        } else {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, [fetchMypage]);

  // FEELCYCLE連携
  const handleFcLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setFcLinking(true);
    setFcLinkError(null);

    try {
      const res = await fetch('/api/auth/feelcycle-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fcEmail, password: fcPassword }),
      });

      const body = await res.json();

      if (!res.ok) {
        setFcLinkError(body.error || '連携に失敗しました');
        return;
      }

      // 連携成功 → ページリロードで最新データ取得
      window.location.reload();
    } catch {
      setFcLinkError('通信エラーが発生しました');
    } finally {
      setFcLinking(false);
    }
  };

  // 履歴取得
  const fetchHistory = useCallback(async (month: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/history?month=${month}`);
      const d = await res.json();
      setHistoryRecords(d.records || []);
    } catch {
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // スタジオタブ表示フラグ
  const [studioTabShown, setStudioTabShown] = useState(false);

  // タブ切り替えハンドラ
  const handleTabChange = useCallback((value: string) => {
    if (value === 'history' && !historyLoaded) {
      setHistoryLoaded(true);
      fetchHistory(selectedMonth);
    }
    if (value === 'studios') {
      setStudioTabShown(true);
    }
  }, [historyLoaded, selectedMonth, fetchHistory]);

  // 月変更時に再取得
  useEffect(() => {
    if (historyLoaded) {
      fetchHistory(selectedMonth);
    }
  }, [selectedMonth, historyLoaded, fetchHistory]);

  // 入会年月保存
  const handleSaveJoined = async () => {
    setSaving(true);
    setSaveMessage(null);
    const joinedAt = joinedYear && joinedMonth
      ? `${joinedYear}-${joinedMonth}-01`
      : null;
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinedAt }),
      });
      if (!res.ok) throw new Error();
      setSaveMessage({ type: 'success', text: '保存しました' });
    } catch {
      setSaveMessage({ type: 'error', text: '保存に失敗しました' });
    } finally {
      setSaving(false);
    }
  };

  // 履歴同期
  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/history/sync', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) {
        setSyncMessage(d.error || '同期に失敗しました');
      } else {
        setSyncMessage(`${d.synced}件の履歴を同期しました（${d.monthsFetched}ヶ月分）`);
        fetchHistory(selectedMonth);
      }
    } catch {
      setSyncMessage('通信エラーが発生しました');
    } finally {
      setSyncing(false);
    }
  };

  // LINE通知解除
  const handleUnlinkLine = async () => {
    setUnlinking(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: null }),
      });
      if (res.ok) {
        setLineLinked(false);
        setShowUnlinkConfirm(false);
      }
    } catch {
      // エラー時はモーダルを閉じない
    } finally {
      setUnlinking(false);
    }
  };

  // 年月オプション
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2011 }, (_, i) => String(2012 + i));
  const months12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  // 履歴月選択オプション（2年前〜今月）
  const monthOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // 履歴統計
  const totalLessons = historyRecords.length;
  const uniqueInstructors = new Set(historyRecords.map((r) => r.instructorName)).size;
  const uniquePrograms = new Set(historyRecords.map((r) => r.programName)).size;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // FEELCYCLE未連携 → 連携フォーム表示
  if (fcNotLinked) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold">マイページ</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              FEELCYCLE連携
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              FEELCYCLEのアカウントと連携すると、会員情報・予約・受講履歴を確認できます。
            </p>
            <form onSubmit={handleFcLink} className="space-y-4">
              {fcLinkError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                  {fcLinkError}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="fc-email">FEELCYCLEメールアドレス</Label>
                <Input
                  id="fc-email"
                  type="email"
                  value={fcEmail}
                  onChange={(e) => setFcEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={fcLinking}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fc-password">FEELCYCLEパスワード</Label>
                <Input
                  id="fc-password"
                  type="password"
                  value={fcPassword}
                  onChange={(e) => setFcPassword(e.target.value)}
                  placeholder="FEELCYCLEのパスワード"
                  required
                  disabled={fcLinking}
                />
              </div>
              <Button type="submit" className="w-full" disabled={fcLinking}>
                {fcLinking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    連携中...
                  </>
                ) : (
                  <>
                    <LinkIcon className="mr-2 h-4 w-4" />
                    FEELCYCLEと連携
                  </>
                )}
              </Button>
            </form>
            <p className="mt-4 text-xs text-center text-muted-foreground">
              認証情報は暗号化して保存され、セッション更新に使用されます。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center gap-4 text-center">
            <p className="font-medium">エラーが発生しました</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">マイページ</h1>

      <Tabs defaultValue="overview" onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="studios">スタジオ</TabsTrigger>
          <TabsTrigger value="history">履歴</TabsTrigger>
        </TabsList>

        {/* 概要タブ: 会員情報 + チケット + 入会年月設定 */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                会員情報
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">会員名</span>
                <span className="font-medium">{data.mypage.displayName || '—'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">所属店舗</span>
                <span className="font-medium">{data.mypage.homeStore || '—'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">プラン</span>
                <span className="font-medium">{data.mypage.membershipType || '—'}</span>
              </div>
              {data.mypage.monthlyClubFee != null && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">月額</span>
                    <span className="font-medium">{data.mypage.monthlyClubFee.toLocaleString()}円</span>
                  </div>
                </>
              )}
              {data.mypage.longPlan && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">長期プラン</span>
                    <span className="font-medium">{data.mypage.longPlan.name}</span>
                  </div>
                </>
              )}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">累計受講回数</span>
                <span className="font-medium">{data.mypage.totalAttendance}回</span>
              </div>
            </CardContent>
          </Card>

          {/* チケット */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                チケット
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.tickets.length === 0 ? (
                <p className="text-muted-foreground text-sm">チケットはありません</p>
              ) : (
                <div className="space-y-3">
                  {data.tickets.map((t, i) => (
                    <div key={i} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">{t.name}</p>
                        <Badge variant="secondary" className="text-sm font-bold">
                          {t.totalCount}枚
                        </Badge>
                      </div>
                      {t.details.length > 0 && (
                        <div className="space-y-1">
                          {t.details.map((d, j) => (
                            <div key={j} className="flex justify-between text-xs text-muted-foreground">
                              <span>{d.expiresAt} まで</span>
                              <span>{d.count}枚</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 入会年月設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">入会年月</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                入会年月を設定すると、受講履歴の取得範囲が最適化されます
              </p>
              <div className="space-y-2">
                <Label>入会年月</Label>
                <div className="flex gap-2">
                  <Select value={joinedYear} onValueChange={setJoinedYear}>
                    <SelectTrigger className="w-28">
                      <SelectValue placeholder="年" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={y}>{y}年</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={joinedMonth} onValueChange={setJoinedMonth}>
                    <SelectTrigger className="w-24">
                      <SelectValue placeholder="月" />
                    </SelectTrigger>
                    <SelectContent>
                      {months12.map((m) => (
                        <SelectItem key={m} value={m}>{Number(m)}月</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {saveMessage && (
                <p className={`text-sm ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                  {saveMessage.text}
                </p>
              )}
              <Button size="sm" onClick={handleSaveJoined} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                保存
              </Button>
            </CardContent>
          </Card>

          {/* LINE通知設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-5 w-5" />
                LINE通知
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                満席レッスンに空きが出たときにLINEで通知を受け取れます。
                レッスン一覧で満席レッスンをタップして「空き通知」を登録してください。
              </p>
              {lineLinked ? (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-[#06C755] font-medium">LINE連携済み</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setShowUnlinkConfirm(true)}
                  >
                    <BellOff className="h-3.5 w-3.5 mr-1" />
                    通知を解除
                  </Button>
                </div>
              ) : (
                <div className="mt-3">
                  <span className="text-xs text-muted-foreground">LINE通知は無効です。再度有効にするにはLINEで再ログインしてください。</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* LINE通知解除確認モーダル */}
          <Dialog open={showUnlinkConfirm} onOpenChange={setShowUnlinkConfirm}>
            <DialogContent className="max-w-xs">
              <DialogHeader>
                <DialogTitle>LINE通知を解除</DialogTitle>
                <DialogDescription>
                  LINE通知を解除すると、空き通知やキャンセル待ちの通知が届かなくなります。再度LINEでログインすると通知を再開できます。
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowUnlinkConfirm(false)}
                  disabled={unlinking}
                >
                  キャンセル
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={handleUnlinkLine}
                  disabled={unlinking}
                >
                  {unlinking ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  解除する
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* スタジオタブ */}
        <TabsContent value="studios">
          {studioTabShown && <StudioTab programColors={programColors} />}
        </TabsContent>

        {/* 履歴タブ */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => {
                  const [y, mo] = m.split('-');
                  return (
                    <SelectItem key={m} value={m}>
                      {y}年{Number(mo)}月
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              同期
            </Button>
          </div>

          {syncMessage && (
            <p className="text-sm text-muted-foreground bg-muted p-2 rounded">{syncMessage}</p>
          )}

          {/* 統計サマリー */}
          {!historyLoading && historyRecords.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{totalLessons}</p>
                  <p className="text-xs text-muted-foreground">レッスン数</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{uniqueInstructors}</p>
                  <p className="text-xs text-muted-foreground">インストラクター</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 text-center">
                  <p className="text-2xl font-bold">{uniquePrograms}</p>
                  <p className="text-xs text-muted-foreground">プログラム</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 履歴リスト */}
          {historyLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : historyRecords.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <p>この月の受講履歴はありません</p>
                <p className="text-xs mt-1">「同期」ボタンでFEELCYCLEから取得できます</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {(() => {
                    const [y, m] = selectedMonth.split('-');
                    return `${y}年${Number(m)}月`;
                  })()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {historyRecords.map((r, i) => (
                  <div key={r.id}>
                    {i > 0 && <Separator className="my-2" />}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-sm">
                          {programColors[r.programName] ? (
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: programColors[r.programName].colorCode,
                                color: programColors[r.programName].textColor,
                              }}
                            >
                              {r.programName}
                            </span>
                          ) : (
                            <span className="font-medium">{r.programName}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.shiftDate} {r.startTime}〜{r.endTime} / {r.instructorName}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span>{r.storeName}</span>
                          {r.sheetNo && <Badge variant="outline" className="text-xs ml-1">{r.sheetNo}</Badge>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
