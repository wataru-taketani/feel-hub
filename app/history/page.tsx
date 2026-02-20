'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, MapPin } from 'lucide-react';
import HistoryAnalytics from '@/components/history/HistoryAnalytics';
import InstructorMultiSelect from '@/components/lessons/InstructorMultiSelect';
import type { AttendanceRecord } from '@/types';

type ProgramColorMap = Record<string, { colorCode: string; textColor: string }>;
type PeriodMode = 'month' | '3m' | '6m' | '1y' | 'all' | 'custom';

function getPeriodDates(mode: PeriodMode): { from: string; to: string } | null {
  if (mode === 'all' || mode === 'custom' || mode === 'month') return null;
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const months = mode === '3m' ? 3 : mode === '6m' ? 6 : 12;
  const from = new Date(now.getFullYear(), now.getMonth() - months, now.getDate() + 1);
  return { from: from.toISOString().slice(0, 10), to };
}

export default function HistoryPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [programColors, setProgramColors] = useState<ProgramColorMap>({});
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (periodMode === 'month') {
        params.set('month', selectedMonth);
      } else if (periodMode === 'custom') {
        if (customFrom) params.set('from', customFrom);
        if (customTo) params.set('to', customTo);
      } else if (periodMode !== 'all') {
        const dates = getPeriodDates(periodMode);
        if (dates) {
          params.set('from', dates.from);
          params.set('to', dates.to);
        }
      }
      const qs = params.toString();
      const res = await fetch(`/api/history${qs ? `?${qs}` : ''}`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [periodMode, selectedMonth, customFrom, customTo]);

  useEffect(() => {
    if (periodMode === 'custom' && (!customFrom || !customTo)) return;
    fetchHistory();
  }, [periodMode, selectedMonth, customFrom, customTo, fetchHistory]);

  useEffect(() => {
    fetch('/api/programs')
      .then(res => res.json())
      .then(setProgramColors)
      .catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/history/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setSyncMessage(data.error || '同期に失敗しました');
      } else {
        setSyncMessage(`${data.synced}件の履歴を同期しました（${data.monthsFetched}ヶ月分）`);
        fetchHistory();
      }
    } catch {
      setSyncMessage('通信エラーが発生しました');
    } finally {
      setSyncing(false);
    }
  };

  const handlePeriodModeChange = (mode: PeriodMode) => {
    setPeriodMode(mode);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
  };

  // 月選択オプション（2年前〜今月）
  const monthOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // フィルタ候補（その月のrecordsから抽出）
  const programOptions = useMemo(
    () => [...new Set(records.map((r) => r.programName))].sort(),
    [records]
  );
  const instructorOptions = useMemo(
    () => [...new Set(records.map((r) => r.instructorName))].sort(),
    [records]
  );

  // フィルタ適用
  const filteredRecords = useMemo(() => {
    let result = records;
    if (selectedPrograms.length > 0) {
      result = result.filter((r) => selectedPrograms.includes(r.programName));
    }
    if (selectedInstructors.length > 0) {
      result = result.filter((r) => selectedInstructors.includes(r.instructorName));
    }
    return result;
  }, [records, selectedPrograms, selectedInstructors]);

  // 統計（フィルタ後）
  const totalLessons = filteredRecords.length;
  const uniqueInstructors = new Set(filteredRecords.map((r) => r.instructorName)).size;
  const uniquePrograms = new Set(filteredRecords.map((r) => r.programName)).size;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">受講履歴</h1>
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

      <Tabs defaultValue="history">
        <TabsList className="w-full">
          <TabsTrigger value="history" className="flex-1">履歴</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-1">分析</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={periodMode} onValueChange={(v) => handlePeriodModeChange(v as PeriodMode)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">単月</SelectItem>
                  <SelectItem value="3m">過去3ヶ月</SelectItem>
                  <SelectItem value="6m">過去6ヶ月</SelectItem>
                  <SelectItem value="1y">過去1年</SelectItem>
                  <SelectItem value="all">全期間</SelectItem>
                  <SelectItem value="custom">カスタム</SelectItem>
                </SelectContent>
              </Select>
              {periodMode === 'month' && (
                <Select value={selectedMonth} onValueChange={handleMonthChange}>
                  <SelectTrigger className="w-[130px]">
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
              )}
              {periodMode === 'custom' && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="border rounded px-2 py-1.5 text-base bg-background"
                  />
                  <span className="text-sm text-muted-foreground">〜</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="border rounded px-2 py-1.5 text-base bg-background"
                  />
                </div>
              )}
              <InstructorMultiSelect
                instructors={programOptions}
                selected={selectedPrograms}
                onChange={setSelectedPrograms}
                label="プログラム"
                labelUnit="件"
                searchPlaceholder="プログラム名で検索..."
              />
              <InstructorMultiSelect
                instructors={instructorOptions}
                selected={selectedInstructors}
                onChange={setSelectedInstructors}
              />
            </div>

            {/* 統計サマリー */}
            {!loading && filteredRecords.length > 0 && (
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
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : filteredRecords.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  {records.length > 0 ? (
                    <p>条件に一致する履歴はありません</p>
                  ) : (
                    <>
                      <p>{periodMode === 'month' ? 'この月の' : 'この期間の'}受講履歴はありません</p>
                      <p className="text-xs mt-1">「同期」ボタンでFEELCYCLEから取得できます</p>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {(() => {
                      if (periodMode === 'month') {
                        const [y, m] = selectedMonth.split('-');
                        return `${y}年${Number(m)}月`;
                      }
                      if (periodMode === '3m') return '過去3ヶ月';
                      if (periodMode === '6m') return '過去6ヶ月';
                      if (periodMode === '1y') return '過去1年';
                      if (periodMode === 'all') return '全期間';
                      if (periodMode === 'custom' && customFrom && customTo) return `${customFrom} 〜 ${customTo}`;
                      return 'カスタム期間';
                    })()}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {filteredRecords.map((r, i) => (
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
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <HistoryAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
