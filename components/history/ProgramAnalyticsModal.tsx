'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ChevronDown } from 'lucide-react';

type RankingItem = { name: string; count: number };

interface StatsData {
  totalLessons: number;
  programRanking: RankingItem[];
  instructorRanking: RankingItem[];
  studioRanking: RankingItem[];
}

type HistoryRecord = {
  shiftDate: string;
  startTime: string;
  instructorName: string;
  storeName: string;
  programName: string;
};

interface ProgramAnalyticsModalProps {
  programName: string | null;
  open: boolean;
  onClose: () => void;
  colorCode?: string;
  textColor?: string;
}

export default function ProgramAnalyticsModal({
  programName,
  open,
  onClose,
  colorCode,
  textColor,
}: ProgramAnalyticsModalProps) {
  const router = useRouter();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    if (!open || !programName) return;

    setLoading(true);
    setStats(null);
    setRecords([]);
    setHistoryExpanded(false);

    const encodedName = encodeURIComponent(programName);
    Promise.all([
      fetch(`/api/history/stats?program=${encodedName}`).then(r => r.json()),
      fetch(`/api/history?program=${encodedName}`).then(r => r.json()),
    ])
      .then(([statsData, historyData]) => {
        setStats(statsData);
        setRecords(historyData.records || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, programName]);

  const handleSearchLessons = () => {
    if (programName) {
      router.push('/lessons?program=' + encodeURIComponent(programName));
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {programName && colorCode ? (
              <span
                className="inline-block px-2 py-1 rounded text-base font-bold"
                style={{ backgroundColor: colorCode, color: textColor || '#fff' }}
              >
                {programName}
              </span>
            ) : (
              programName
            )}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {programName}の受講分析
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : stats ? (
          <div className="space-y-4">
            {/* 受講回数 */}
            <div className="text-center py-2">
              <p className="text-3xl font-bold">{stats.totalLessons}</p>
              <p className="text-sm text-muted-foreground">回受講</p>
            </div>

            {/* インストラクターランキング */}
            {stats.instructorRanking.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-1.5">インストラクター</h3>
                <div className="space-y-0.5">
                  {stats.instructorRanking.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm py-0.5">
                      <span className="w-5 text-right text-muted-foreground text-xs">#{i + 1}</span>
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="text-muted-foreground text-xs">{item.count}回</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* スタジオランキング */}
            {stats.studioRanking.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-1.5">スタジオ</h3>
                <div className="space-y-0.5">
                  {stats.studioRanking.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 text-sm py-0.5">
                      <span className="w-5 text-right text-muted-foreground text-xs">#{i + 1}</span>
                      <span className="flex-1 truncate">{item.name}</span>
                      <span className="text-muted-foreground text-xs">{item.count}回</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 受講履歴 */}
            {records.length > 0 && (() => {
              const INITIAL_SHOW = 3;
              const display = historyExpanded ? records : records.slice(0, INITIAL_SHOW);
              return (
                <div>
                  <h3 className="text-sm font-medium mb-1.5">受講履歴</h3>
                  <div className="space-y-0.5">
                    {display.map((r, i) => (
                      <div key={`${r.shiftDate}-${r.startTime}-${i}`} className="flex items-center text-sm py-0.5 gap-2">
                        <span className="text-muted-foreground text-xs whitespace-nowrap">{r.shiftDate}</span>
                        <span className="truncate flex-1">{r.instructorName}</span>
                        <span className="text-muted-foreground text-xs whitespace-nowrap">{r.storeName}</span>
                      </div>
                    ))}
                  </div>
                  {records.length > INITIAL_SHOW && (
                    <button
                      className="text-xs text-muted-foreground active:text-foreground mt-1 flex items-center gap-0.5"
                      onClick={() => setHistoryExpanded(!historyExpanded)}
                    >
                      {historyExpanded ? '閉じる' : `もっと見る（全${records.length}件）`}
                      <ChevronDown className={`h-3 w-3 transition-transform ${historyExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
              );
            })()}

            {/* レッスン検索ボタン */}
            <Button className="w-full" onClick={handleSearchLessons}>
              <Search className="h-4 w-4 mr-2" />
              このレッスンを探す
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">データの取得に失敗しました</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
