'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, MapPin } from 'lucide-react';
import HistoryAnalytics from '@/components/history/HistoryAnalytics';
import type { AttendanceRecord } from '@/types';

type ProgramColorMap = Record<string, { colorCode: string; textColor: string }>;

export default function HistoryPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [programColors, setProgramColors] = useState<ProgramColorMap>({});

  const fetchHistory = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/history?month=${month}`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(selectedMonth);
  }, [selectedMonth, fetchHistory]);

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
        fetchHistory(selectedMonth);
      }
    } catch {
      setSyncMessage('通信エラーが発生しました');
    } finally {
      setSyncing(false);
    }
  };

  // 月選択オプション（2年前〜今月）
  const monthOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // 統計
  const totalLessons = records.length;
  const uniqueInstructors = new Set(records.map((r) => r.instructorName)).size;
  const uniquePrograms = new Set(records.map((r) => r.programName)).size;

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
            <div className="flex items-center gap-4">
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
            </div>

            {/* 統計サマリー */}
            {!loading && records.length > 0 && (
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
            ) : records.length === 0 ? (
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
                  {records.map((r, i) => (
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
