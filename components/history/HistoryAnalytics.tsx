'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, RotateCcw, X, Loader2 } from 'lucide-react';
import InstructorMultiSelect from '@/components/lessons/InstructorMultiSelect';

type HistoryRecord = {
  shiftDate: string;
  instructorName: string;
  storeName: string;
  startTime: string;
  programName: string;
  sheetNo: number | null;
};

type RankingItem = { name: string; count: number };

interface StatsData {
  totalLessons: number;
  programRanking: RankingItem[];
  instructorRanking: RankingItem[];
  studioRanking: RankingItem[];
}

type ProgramColorMap = Record<string, { colorCode: string; textColor: string }>;

type PeriodPreset = 'month' | '3m' | '6m' | '1y' | 'all' | 'custom';

function getPeriodDates(preset: PeriodPreset): { from: string; to: string } | null {
  if (preset === 'all' || preset === 'custom' || preset === 'month') return null;

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const months = preset === '3m' ? 3 : preset === '6m' ? 6 : 12;
  const from = new Date(now.getFullYear(), now.getMonth() - months, now.getDate() + 1);
  return { from: from.toISOString().slice(0, 10), to };
}

function getMonthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

const INITIAL_SHOW = 10;

function RankingSection({
  title,
  items,
  programColors,
  isProgram,
  onTapItem,
}: {
  title: string;
  items: RankingItem[];
  programColors?: ProgramColorMap;
  isProgram?: boolean;
  onTapItem?: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const display = expanded ? items : items.slice(0, INITIAL_SHOW);

  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <div className="space-y-1">
        {display.map((item, i) => (
          <div
            key={item.name}
            className={`flex items-center gap-2 text-sm py-1 rounded -mx-1 px-1 ${onTapItem ? 'cursor-pointer active:bg-accent/50 hover:bg-accent/30' : ''}`}
            onClick={() => onTapItem?.(item.name)}
          >
            <span className="w-6 text-right text-muted-foreground text-xs">#{i + 1}</span>
            {isProgram && programColors?.[item.name] ? (
              <span
                className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: programColors[item.name].colorCode,
                  color: programColors[item.name].textColor,
                }}
              >
                {item.name}
              </span>
            ) : (
              <span className="flex-1 truncate">{item.name}</span>
            )}
            {isProgram && programColors?.[item.name] && <span className="flex-1" />}
            <span className="text-muted-foreground text-xs">{item.count}回</span>
          </div>
        ))}
      </div>
      {items.length > INITIAL_SHOW && (
        <button
          className="text-xs text-muted-foreground hover:text-foreground mt-1 flex items-center gap-0.5"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '閉じる' : `もっと見る（全${items.length}件）`}
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

/** アクティブフィルターチップ */
function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1 text-xs">
      {label}
      <button onClick={onClear} className="hover:bg-accent rounded-full p-0.5">
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

export default function HistoryAnalytics() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodPreset>('all');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // 月選択オプション（2年前〜今月）
  const monthOptions: string[] = [];
  {
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  }

  // フィルター（InstructorMultiSelect）
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedInstructors, setSelectedInstructors] = useState<string[]>([]);
  // タップで設定されたフィルター（詳細レコード表示用）
  const [tappedProgram, setTappedProgram] = useState<string | null>(null);
  const [tappedStudio, setTappedStudio] = useState<string | null>(null);

  const [splitInstructor, setSplitInstructor] = useState(false);
  const [programColors, setProgramColors] = useState<ProgramColorMap>({});

  // 選択候補（初回ロード時にキャッシュ）
  const [programOptions, setProgramOptions] = useState<string[]>([]);
  const [instructorOptions, setInstructorOptions] = useState<string[]>([]);

  // プログラム詳細レコード
  const [detailRecords, setDetailRecords] = useState<HistoryRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);

  // スタジオ詳細レコード
  const [studioDetailRecords, setStudioDetailRecords] = useState<HistoryRecord[]>([]);
  const [studioDetailLoading, setStudioDetailLoading] = useState(false);
  const [studioDetailExpanded, setStudioDetailExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/programs')
      .then(res => res.json())
      .then(setProgramColors)
      .catch(() => {});
  }, []);

  // プログラム詳細レコード取得
  useEffect(() => {
    if (!tappedProgram) {
      setDetailRecords([]);
      setDetailExpanded(false);
      return;
    }
    const fetchDetail = async () => {
      setDetailLoading(true);
      setDetailExpanded(false);
      try {
        const params = new URLSearchParams({ program: tappedProgram });
        if (period === 'month') {
          const range = getMonthRange(selectedMonth);
          params.set('from', range.from);
          params.set('to', range.to);
        } else if (period === 'custom') {
          if (customFrom) params.set('from', customFrom);
          if (customTo) params.set('to', customTo);
        } else {
          const dates = getPeriodDates(period);
          if (dates) {
            params.set('from', dates.from);
            params.set('to', dates.to);
          }
        }
        const res = await fetch(`/api/history?${params.toString()}`);
        const data = await res.json();
        setDetailRecords(data.records || []);
      } catch {
        setDetailRecords([]);
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [tappedProgram, period, selectedMonth, customFrom, customTo]);

  // スタジオ詳細レコード取得
  useEffect(() => {
    if (!tappedStudio) {
      setStudioDetailRecords([]);
      setStudioDetailExpanded(false);
      return;
    }
    const fetchStudioDetail = async () => {
      setStudioDetailLoading(true);
      setStudioDetailExpanded(false);
      try {
        const params = new URLSearchParams({ store: tappedStudio });
        if (period === 'month') {
          const range = getMonthRange(selectedMonth);
          params.set('from', range.from);
          params.set('to', range.to);
        } else if (period === 'custom') {
          if (customFrom) params.set('from', customFrom);
          if (customTo) params.set('to', customTo);
        } else {
          const dates = getPeriodDates(period);
          if (dates) {
            params.set('from', dates.from);
            params.set('to', dates.to);
          }
        }
        const res = await fetch(`/api/history?${params.toString()}`);
        const data = await res.json();
        setStudioDetailRecords(data.records || []);
      } catch {
        setStudioDetailRecords([]);
      } finally {
        setStudioDetailLoading(false);
      }
    };
    fetchStudioDetail();
  }, [tappedStudio, period, selectedMonth, customFrom, customTo]);

  // 実際にAPIに送る値
  const effectiveProgram = selectedPrograms.join(',');
  const effectiveInstructor = selectedInstructors.join(',');
  const effectiveStudio = tappedStudio || '';

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (period === 'month') {
        const range = getMonthRange(selectedMonth);
        params.set('from', range.from);
        params.set('to', range.to);
      } else if (period === 'custom') {
        if (customFrom) params.set('from', customFrom);
        if (customTo) params.set('to', customTo);
      } else {
        const dates = getPeriodDates(period);
        if (dates) {
          params.set('from', dates.from);
          params.set('to', dates.to);
        }
      }
      if (effectiveProgram) params.set('program', effectiveProgram);
      if (effectiveInstructor) params.set('instructor', effectiveInstructor);
      if (effectiveStudio) params.set('studio', effectiveStudio);
      if (splitInstructor) params.set('splitInstructor', '1');

      const res = await fetch(`/api/history/stats?${params.toString()}`);
      const data = await res.json();
      setStats(data);

      // フィルタ未適用時に選択候補を更新
      if (!effectiveProgram && !effectiveInstructor) {
        setProgramOptions((data.programRanking || []).map((r: RankingItem) => r.name));
        setInstructorOptions((data.instructorRanking || []).map((r: RankingItem) => r.name));
      }
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [period, selectedMonth, customFrom, customTo, effectiveProgram, effectiveInstructor, effectiveStudio, splitInstructor]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const uniqueInstructors = useMemo(() => stats?.instructorRanking.length ?? 0, [stats]);
  const uniquePrograms = useMemo(() => stats?.programRanking.length ?? 0, [stats]);

  const handleTapProgram = useCallback((name: string) => {
    setTappedProgram(name);
    setSelectedPrograms(prev => prev.includes(name) ? prev : [name]);
  }, []);

  const handleTapInstructor = useCallback((name: string) => {
    setSelectedInstructors(prev => prev.includes(name) ? prev : [name]);
  }, []);

  const handleTapStudio = useCallback((name: string) => {
    setTappedStudio(name);
  }, []);

  const hasActiveFilter = !!(selectedPrograms.length > 0 || selectedInstructors.length > 0 || tappedStudio);

  const hasAnyFilter = period !== 'all' || selectedPrograms.length > 0 || selectedInstructors.length > 0 || !!tappedStudio || splitInstructor;

  const handleClearAll = useCallback(() => {
    setPeriod('all');
    setCustomFrom('');
    setCustomTo('');
    setSelectedPrograms([]);
    setSelectedInstructors([]);
    setTappedProgram(null);
    setTappedStudio(null);
    setSplitInstructor(false);
  }, []);

  return (
    <div className="space-y-4">
      {/* フィルター */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
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
          {period === 'month' && (
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
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
          {period === 'custom' && (
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
        </div>
        <div className="flex items-center gap-2">
          <InstructorMultiSelect
            instructors={programOptions}
            selected={selectedPrograms}
            onChange={(v) => { setSelectedPrograms(v); if (v.length === 0) setTappedProgram(null); }}
            label="プログラム"
            labelUnit="件"
            searchPlaceholder="プログラム名で検索..."
          />
          <InstructorMultiSelect
            instructors={instructorOptions}
            selected={selectedInstructors}
            onChange={setSelectedInstructors}
          />
          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1 px-2 text-muted-foreground"
              onClick={handleClearAll}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              クリア
            </Button>
          )}
        </div>
      </div>

      {/* フィルターチップ */}
      {tappedStudio && (
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip label={tappedStudio} onClear={() => setTappedStudio(null)} />
        </div>
      )}

      {/* Wイントラ分割 */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={splitInstructor}
          onChange={(e) => setSplitInstructor(e.target.checked)}
          className="rounded border-gray-300"
        />
        Wイントラを個別に集計
      </label>

      {/* ローディング */}
      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !stats || stats.totalLessons === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>該当する受講履歴がありません</p>
            <p className="text-xs mt-1">期間や検索条件を変更してみてください</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{stats.totalLessons}</p>
                <p className="text-xs text-muted-foreground">レッスン数</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{uniquePrograms}</p>
                <p className="text-xs text-muted-foreground">プログラム種類</p>
              </CardContent>
            </Card>
          </div>

          {/* ランキング */}
          <Card>
            <CardContent className="pt-4 space-y-4">
              <RankingSection
                title="プログラム"
                items={stats.programRanking}
                programColors={programColors}
                isProgram
                onTapItem={handleTapProgram}
              />
              <RankingSection
                title={`インストラクター（${uniqueInstructors}人）`}
                items={stats.instructorRanking}
                onTapItem={handleTapInstructor}
              />
              <RankingSection
                title="スタジオ"
                items={stats.studioRanking}
                onTapItem={handleTapStudio}
              />
            </CardContent>
          </Card>

          {/* プログラム詳細レコード */}
          {tappedProgram && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  {programColors[tappedProgram] ? (
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: programColors[tappedProgram].colorCode,
                        color: programColors[tappedProgram].textColor,
                      }}
                    >
                      {tappedProgram}
                    </span>
                  ) : (
                    <span className="text-sm font-medium">{tappedProgram}</span>
                  )}
                  <span className="text-xs text-muted-foreground">受講履歴</span>
                </div>
                {detailLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : detailRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">レコードなし</p>
                ) : (
                  <>
                    <div className="space-y-0.5">
                      {(detailExpanded ? detailRecords : detailRecords.slice(0, INITIAL_SHOW)).map((r, i) => (
                        <div key={`${r.shiftDate}-${r.startTime}-${i}`} className="flex items-center text-sm py-0.5 gap-3">
                          <span className="text-muted-foreground text-xs whitespace-nowrap">{r.shiftDate}</span>
                          <span className="truncate flex-1">{r.instructorName}</span>
                          <span className="text-muted-foreground text-xs whitespace-nowrap">{r.storeName}</span>
                        </div>
                      ))}
                    </div>
                    {detailRecords.length > INITIAL_SHOW && (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground mt-1 flex items-center gap-0.5"
                        onClick={() => setDetailExpanded(!detailExpanded)}
                      >
                        {detailExpanded ? '閉じる' : `もっと見る（全${detailRecords.length}件）`}
                        <ChevronDown className={`h-3 w-3 transition-transform ${detailExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* スタジオ詳細レコード */}
          {tappedStudio && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium">{tappedStudio}</span>
                  <span className="text-xs text-muted-foreground">受講履歴</span>
                </div>
                {studioDetailLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : studioDetailRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">レコードなし</p>
                ) : (
                  <>
                    {/* バイクNo.分布 */}
                    {(() => {
                      const bikeCounts: Record<string, number> = {};
                      for (const r of studioDetailRecords) {
                        if (r.sheetNo) {
                          const key = `#${r.sheetNo}`;
                          bikeCounts[key] = (bikeCounts[key] || 0) + 1;
                        }
                      }
                      const bikeRanking = Object.entries(bikeCounts)
                        .sort((a, b) => b[1] - a[1]);
                      if (bikeRanking.length === 0) return null;
                      return (
                        <div className="mb-3 text-sm">
                          <span className="text-muted-foreground text-xs">よく使う席: </span>
                          {bikeRanking.slice(0, 5).map(([no, count], i) => (
                            <span key={no}>
                              {i > 0 && <span className="text-muted-foreground"> </span>}
                              <span className="font-medium">{no}</span>
                              <span className="text-muted-foreground text-xs">({count}回)</span>
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                    <div className="space-y-0.5">
                      {(studioDetailExpanded ? studioDetailRecords : studioDetailRecords.slice(0, INITIAL_SHOW)).map((r, i) => (
                        <div key={`${r.shiftDate}-${r.startTime}-${i}`} className="flex items-center text-sm py-0.5 gap-2">
                          <span className="text-muted-foreground text-xs whitespace-nowrap">{r.shiftDate}</span>
                          <span className="truncate flex-1">{r.programName}</span>
                          <span className="truncate text-xs text-muted-foreground">{r.instructorName}</span>
                          {r.sheetNo && (
                            <span className="text-xs font-medium whitespace-nowrap">#{r.sheetNo}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {studioDetailRecords.length > INITIAL_SHOW && (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground mt-1 flex items-center gap-0.5"
                        onClick={() => setStudioDetailExpanded(!studioDetailExpanded)}
                      >
                        {studioDetailExpanded ? '閉じる' : `もっと見る（全${studioDetailRecords.length}件）`}
                        <ChevronDown className={`h-3 w-3 transition-transform ${studioDetailExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
