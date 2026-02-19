'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, ChevronDown, Star, Loader2, ArrowUpDown, Save } from 'lucide-react';
import { formatStudio, STUDIO_REGIONS } from '@/lib/lessonUtils';
import type { AttendanceRecord } from '@/types';

const SeatMap = lazy(() => import('@/components/lessons/SeatMap'));

type ProgramColorMap = Record<string, { colorCode: string; textColor: string }>;

interface StudioRanking {
  name: string;
  count: number;
}

interface StudioTabProps {
  programColors: ProgramColorMap;
}

// store_name から略称部分を除去: "銀座（GNZ）" or "銀座(GNZ)" → "銀座"
function stripStoreAbbr(storeName: string): string {
  return storeName.replace(/[（(].*[）)]$/, '').trim();
}

// STUDIO_REGIONS からフラットなスタジオ名リスト（エリア順）を生成
function getAllStudiosInAreaOrder(): string[] {
  const studios: string[] = [];
  for (const region of STUDIO_REGIONS) {
    for (const pref of region.prefectures) {
      for (const s of pref.studios) {
        studios.push(s);
      }
    }
  }
  return studios;
}

// スタジオ → エリア名のマップ
function getStudioAreaMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const region of STUDIO_REGIONS) {
    for (const pref of region.prefectures) {
      for (const s of pref.studios) {
        map[s] = region.area;
      }
    }
  }
  return map;
}

type SortMode = 'count' | 'area';

export default function StudioTab({ programColors }: StudioTabProps) {
  const [rankingMap, setRankingMap] = useState<Record<string, number>>({});
  // 正規化名 → 元の store_name（API呼び出し用）
  const [storeNameMap, setStoreNameMap] = useState<Record<string, string>>({});
  const [preferences, setPreferences] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('count');
  const [expandedStudio, setExpandedStudio] = useState<string | null>(null);

  // 展開中スタジオの詳細
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [seatCounts, setSeatCounts] = useState<{ seat: string; count: number }[]>([]);

  // おすすめバイク選択
  const [showSeatMap, setShowSeatMap] = useState(false);
  const [seatMapSidHash, setSeatMapSidHash] = useState<string | null>(null);
  const [seatMapLoading, setSeatMapLoading] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const allStudios = getAllStudiosInAreaOrder();
  const studioAreaMap = getStudioAreaMap();

  // 初回データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, prefsRes] = await Promise.all([
          fetch('/api/history/stats'),
          fetch('/api/seat-preferences'),
        ]);
        const statsData = await statsRes.json();
        const prefsData = await prefsRes.json();
        const map: Record<string, number> = {};
        const nameMap: Record<string, string> = {};
        for (const item of (statsData.studioRanking || []) as StudioRanking[]) {
          // store_name は「銀座（GNZ）」or「銀座(GNZ)」形式 → 「銀座」に正規化
          const normalized = stripStoreAbbr(item.name);
          map[normalized] = (map[normalized] || 0) + item.count;
          nameMap[normalized] = item.name; // 元のstore_name を保持
        }
        setRankingMap(map);
        setStoreNameMap(nameMap);
        setPreferences(prefsData.preferences || {});
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ソート済みスタジオリスト
  const sortedStudios = (() => {
    if (sortMode === 'area') {
      return allStudios;
    }
    // 受講回数順: 回数 desc、0回は末尾にエリア順で並べる
    const withCount = allStudios.map(s => ({ name: s, count: rankingMap[s] || 0 }));
    return withCount
      .sort((a, b) => {
        if (a.count !== b.count) return b.count - a.count;
        // 同じ回数ならエリア順（allStudios の index）
        return allStudios.indexOf(a.name) - allStudios.indexOf(b.name);
      })
      .map(s => s.name);
  })();

  // エリア順の場合のグループ判定
  const getAreaLabel = (studio: string, index: number): string | null => {
    if (sortMode !== 'area') return null;
    const area = studioAreaMap[studio];
    if (index === 0) return area;
    const prevArea = studioAreaMap[sortedStudios[index - 1]];
    return area !== prevArea ? area : null;
  };

  // スタジオ展開時
  const handleExpand = useCallback(async (studio: string) => {
    if (expandedStudio === studio) {
      setExpandedStudio(null);
      setShowSeatMap(false);
      return;
    }
    setExpandedStudio(studio);
    setRecentLoading(true);
    setRecentRecords([]);
    setSeatCounts([]);
    setSaveMessage(null);
    setShowSeatMap(false);
    setSeatMapSidHash(null);
    setSelectedSeats(preferences[studio] || []);

    try {
      // store_name は元の形式（銀座（GNZ） or 銀座(GNZ)）で検索
      const storeName = storeNameMap[studio] || studio;
      const res = await fetch(`/api/history?store=${encodeURIComponent(storeName)}`);
      const data = await res.json();
      const records: AttendanceRecord[] = data.records || [];

      setRecentRecords(records.slice(0, 5));

      const counts: Record<string, number> = {};
      for (const r of records) {
        if (r.sheetNo) {
          counts[r.sheetNo] = (counts[r.sheetNo] || 0) + 1;
        }
      }
      const sorted = Object.entries(counts)
        .map(([seat, count]) => ({ seat, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setSeatCounts(sorted);
    } catch {
      // ignore
    } finally {
      setRecentLoading(false);
    }
  }, [expandedStudio, preferences, storeNameMap]);

  // SeatMap 表示トグル
  const handleShowSeatMap = async (studio: string) => {
    if (showSeatMap) {
      setShowSeatMap(false);
      return;
    }
    setSeatMapLoading(true);
    setSeatMapSidHash(null);
    try {
      const res = await fetch(`/api/seatmap/find-sid?studio=${encodeURIComponent(studio)}`);
      const data = await res.json();
      if (data.sidHash) {
        setSeatMapSidHash(data.sidHash);
        setShowSeatMap(true);
      } else {
        setSaveMessage('このスタジオのバイクマップが見つかりません');
      }
    } catch {
      setSaveMessage('バイクマップの取得に失敗しました');
    } finally {
      setSeatMapLoading(false);
    }
  };

  // おすすめバイク保存
  const handleSavePreferences = async (studio: string) => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/seat-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studio, seatNumbers: selectedSeats }),
      });
      if (!res.ok) throw new Error();
      setPreferences(prev => {
        const next = { ...prev };
        if (selectedSeats.length === 0) {
          delete next[studio];
        } else {
          next[studio] = [...selectedSeats];
        }
        return next;
      });
      setSaveMessage('保存しました');
    } catch {
      setSaveMessage('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">スタジオ別情報</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setSortMode(prev => prev === 'count' ? 'area' : 'count')}
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortMode === 'count' ? '受講回数順' : 'エリア順'}
        </Button>
      </div>

      {sortedStudios.map((studio, index) => {
        const count = rankingMap[studio] || 0;
        const isExpanded = expandedStudio === studio;
        const favSeats = preferences[studio];
        const areaLabel = getAreaLabel(studio, index);

        return (
          <div key={studio}>
            {areaLabel && (
              <p className="text-xs font-medium text-muted-foreground mt-2 mb-1 px-1">{areaLabel}</p>
            )}
            <Card className="overflow-hidden">
              {/* ヘッダー行 */}
              <button
                className="w-full text-left p-3 active:bg-muted/50 transition-colors"
                onClick={() => handleExpand(studio)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{formatStudio(studio)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {count > 0 ? `${count}回` : '—'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span>
                        {favSeats && favSeats.length > 0
                          ? favSeats.map(s => `#${s}`).join(' ')
                          : '未設定'}
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              </button>

              {/* 展開コンテンツ */}
              {isExpanded && (
                <CardContent className="pt-0 pb-3 space-y-3">
                  <Separator />

                  {/* おすすめバイク番号 */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">おすすめバイク番号</p>
                    {!showSeatMap ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs"
                        onClick={() => handleShowSeatMap(studio)}
                        disabled={seatMapLoading}
                      >
                        {seatMapLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Star className="h-3.5 w-3.5 mr-1" />
                        )}
                        おすすめバイクを選択
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        {seatMapSidHash && (
                          <Suspense fallback={<Skeleton className="w-full h-48 rounded-lg" />}>
                            <SeatMap
                              sidHash={seatMapSidHash}
                              multiSelect
                              selectedSeats={selectedSeats}
                              onSelectedSeatsChange={setSelectedSeats}
                            />
                          </Suspense>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            onClick={() => setShowSeatMap(false)}
                          >
                            閉じる
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs"
                            onClick={() => handleSavePreferences(studio)}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                              <Save className="h-3.5 w-3.5 mr-1" />
                            )}
                            保存
                          </Button>
                        </div>
                      </div>
                    )}
                    {saveMessage && (
                      <p className={`text-xs ${saveMessage === '保存しました' ? 'text-green-600' : 'text-red-600'}`}>
                        {saveMessage}
                      </p>
                    )}
                  </div>

                  {recentLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : (
                    <>
                      {/* よく使う席 */}
                      {seatCounts.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">よく使うバイク</p>
                          <div className="flex flex-wrap gap-1.5">
                            {seatCounts.map(({ seat, count: c }) => (
                              <Badge key={seat} variant="outline" className="text-xs">
                                #{seat}（{c}回）
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 最近の受講 */}
                      {recentRecords.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">最近の受講</p>
                          <div className="space-y-1">
                            {recentRecords.map((r) => (
                              <div key={r.id} className="flex items-center gap-1.5 text-xs">
                                <span className="text-muted-foreground w-12 shrink-0">
                                  {r.shiftDate.slice(5)}
                                </span>
                                {programColors[r.programName] ? (
                                  <span
                                    className="inline-block px-1 py-0.5 rounded text-[10px] font-medium leading-none"
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
                                <span className="text-muted-foreground truncate">{r.instructorName}</span>
                                {r.sheetNo && (
                                  <span className="ml-auto shrink-0 text-muted-foreground">#{r.sheetNo}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
}
