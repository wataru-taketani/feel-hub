'use client';

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, ChevronDown, Star, Loader2, ArrowUpDown, Save } from 'lucide-react';
import type { AttendanceRecord } from '@/types';

const SeatMap = lazy(() => import('@/components/lessons/SeatMap'));

type ProgramColorMap = Record<string, { colorCode: string; textColor: string }>;

interface StudioRanking {
  name: string;
  count: number;
}

interface StudioMaster {
  store_id: string;
  name: string;
  abbreviation: string;
  area: string | null;
  prefecture: string | null;
  is_active: boolean;
}

interface StudioTabProps {
  programColors: ProgramColorMap;
}

// store_name から略称コードを抽出: "銀座（GNZ）" or "銀座(GNZ)" → "GNZ"
function extractAbbr(storeName: string): string {
  const match = storeName.match(/[（(]([^）)]+)[）)]/);
  return match ? match[1] : '';
}

const AREA_ORDER = ['北海道・東北', '関東', '東海・関西', '中国・四国・九州'];

type SortMode = 'count' | 'area';

export default function StudioTab({ programColors }: StudioTabProps) {
  const [studioMasters, setStudioMasters] = useState<StudioMaster[]>([]);
  // abbreviation → 受講回数
  const [rankingByAbbr, setRankingByAbbr] = useState<Record<string, number>>({});
  // abbreviation → 元の store_name（API呼び出し用）
  const [storeNameByAbbr, setStoreNameByAbbr] = useState<Record<string, string>>({});
  const [preferences, setPreferences] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>('count');
  // expandedStudio は abbreviation で管理
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

  // abbreviation → StudioMaster lookup
  const studioByAbbr = useMemo(() => {
    const map = new Map<string, StudioMaster>();
    for (const s of studioMasters) {
      map.set(s.abbreviation, s);
    }
    return map;
  }, [studioMasters]);

  // 初回データ取得
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studiosRes, statsRes, prefsRes] = await Promise.all([
          fetch('/api/studios'),
          fetch('/api/history/stats'),
          fetch('/api/seat-preferences'),
        ]);
        const studiosData = await studiosRes.json();
        const statsData = await statsRes.json();
        const prefsData = await prefsRes.json();

        setStudioMasters(studiosData.studios || []);

        // abbreviation → 受講回数・元 store_name
        const ranking: Record<string, number> = {};
        const nameMap: Record<string, string> = {};
        for (const item of (statsData.studioRanking || []) as StudioRanking[]) {
          const abbr = extractAbbr(item.name);
          if (abbr) {
            ranking[abbr] = (ranking[abbr] || 0) + item.count;
            nameMap[abbr] = item.name;
          }
        }
        setRankingByAbbr(ranking);
        setStoreNameByAbbr(nameMap);
        setPreferences(prefsData.preferences || {});
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 表示用スタジオリスト: active + 閉店（履歴あり）
  const { activeStudios, closedWithHistory } = useMemo(() => {
    const active = studioMasters.filter((s) => s.is_active);
    const closed: StudioMaster[] = [];

    // DB上 is_active=false で受講履歴あり
    for (const s of studioMasters) {
      if (!s.is_active && rankingByAbbr[s.abbreviation]) {
        closed.push(s);
      }
    }
    // 受講履歴にあるがDBに存在しないスタジオ
    for (const [abbr, count] of Object.entries(rankingByAbbr)) {
      if (count > 0 && !studioMasters.some((s) => s.abbreviation === abbr)) {
        const storeName = storeNameByAbbr[abbr] || '';
        const name = storeName.replace(/[（(].*[）)]$/, '').trim() || abbr;
        closed.push({
          store_id: '',
          name,
          abbreviation: abbr,
          area: null,
          prefecture: null,
          is_active: false,
        });
      }
    }

    return { activeStudios: active, closedWithHistory: closed };
  }, [studioMasters, rankingByAbbr, storeNameByAbbr]);

  // レンダリング用グループ
  const studioGroups = useMemo(() => {
    if (sortMode === 'count') {
      const all = [...activeStudios, ...closedWithHistory];
      all.sort((a, b) => {
        const ca = rankingByAbbr[a.abbreviation] || 0;
        const cb = rankingByAbbr[b.abbreviation] || 0;
        return cb - ca;
      });
      return [{ area: null as string | null, studios: all }];
    }

    // エリア順
    const grouped = new Map<string, StudioMaster[]>();
    const other: StudioMaster[] = [];

    for (const s of activeStudios) {
      if (s.area) {
        if (!grouped.has(s.area)) grouped.set(s.area, []);
        grouped.get(s.area)!.push(s);
      } else {
        other.push(s);
      }
    }

    const groups: { area: string | null; studios: StudioMaster[] }[] = [];
    for (const area of AREA_ORDER) {
      if (grouped.has(area)) {
        groups.push({ area, studios: grouped.get(area)! });
      }
    }
    // AREA_ORDER にないエリア
    for (const [area, studios] of grouped) {
      if (!AREA_ORDER.includes(area)) {
        groups.push({ area, studios });
      }
    }
    if (other.length > 0) {
      groups.push({ area: 'その他', studios: other });
    }
    if (closedWithHistory.length > 0) {
      groups.push({ area: '閉店', studios: closedWithHistory });
    }
    return groups;
  }, [sortMode, activeStudios, closedWithHistory, rankingByAbbr]);

  // スタジオ展開時
  const handleExpand = useCallback(async (abbr: string) => {
    if (expandedStudio === abbr) {
      setExpandedStudio(null);
      setShowSeatMap(false);
      return;
    }
    const studio = studioByAbbr.get(abbr);
    const studioName = studio?.name || abbr;

    setExpandedStudio(abbr);
    setRecentLoading(true);
    setRecentRecords([]);
    setSeatCounts([]);
    setSaveMessage(null);
    setShowSeatMap(false);
    setSeatMapSidHash(null);
    setSelectedSeats(preferences[studioName] || []);

    try {
      // store_name は元の形式（銀座（GNZ） or 銀座(GNZ)）で検索
      const storeName = storeNameByAbbr[abbr] || `${studioName}（${abbr}）`;
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
  }, [expandedStudio, preferences, storeNameByAbbr, studioByAbbr]);

  // SeatMap 表示トグル
  const handleShowSeatMap = async (studioName: string) => {
    if (showSeatMap) {
      setShowSeatMap(false);
      return;
    }
    setSeatMapLoading(true);
    setSeatMapSidHash(null);
    try {
      const res = await fetch(`/api/seatmap/find-sid?studio=${encodeURIComponent(studioName)}`);
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
  const handleSavePreferences = async (studioName: string) => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/seat-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studio: studioName, seatNumbers: selectedSeats }),
      });
      if (!res.ok) throw new Error();
      setPreferences(prev => {
        const next = { ...prev };
        if (selectedSeats.length === 0) {
          delete next[studioName];
        } else {
          next[studioName] = [...selectedSeats];
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

      {studioGroups.map((group) => (
        <div key={group.area || 'all'}>
          {group.area && (
            <p className="text-xs font-medium text-muted-foreground mb-1 px-1">{group.area}</p>
          )}
          <Card className="overflow-hidden">
            {group.studios.map((s, index) => {
              const count = rankingByAbbr[s.abbreviation] || 0;
              const isExpanded = expandedStudio === s.abbreviation;
              const favSeats = preferences[s.name];
              const isClosed = !s.is_active;

              return (
                <div key={s.abbreviation}>
                  {index > 0 && <Separator />}
                  {/* ヘッダー行 */}
                  <button
                    className="w-full text-left py-2.5 px-3 active:bg-muted/50 transition-colors"
                    onClick={() => handleExpand(s.abbreviation)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-medium text-sm ${isClosed ? 'text-muted-foreground' : ''}`}>
                          {s.name}（{s.abbreviation}）
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {count > 0 ? `${count}回` : '—'}
                        </Badge>
                        {isClosed && count > 0 && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            閉店
                          </Badge>
                        )}
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
                    <div className="px-3 pb-3 space-y-3">
                      <Separator />

                      {/* おすすめバイク（展開時のみ表示） */}
                      {favSeats && favSeats.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 text-yellow-500" />
                          <span>{favSeats.map(seat => `#${seat}`).join(' ')}</span>
                        </div>
                      )}

                      {/* おすすめバイク選択 */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">おすすめバイク番号</p>
                        {!showSeatMap ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 text-xs"
                            onClick={() => handleShowSeatMap(s.name)}
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
                                onClick={() => handleSavePreferences(s.name)}
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
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}
