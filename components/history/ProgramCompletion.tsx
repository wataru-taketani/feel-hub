'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type FilterMode = 'all' | 'taken' | 'untaken';

interface ProgramItem {
  name: string;
  colorCode: string;
  textColor: string;
  count: number;
}

interface SeriesData {
  seriesName: string;
  programs: ProgramItem[];
}

interface ProgramsResponse {
  series: SeriesData[];
  summary: { total: number; taken: number };
}

export default function ProgramCompletion() {
  const [data, setData] = useState<ProgramsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');

  useEffect(() => {
    fetch('/api/history/programs')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'データの取得に失敗しました');
        }
        return res.json();
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // フィルター適用
  const filteredSeries = useMemo(() => {
    if (!data) return [];
    return data.series
      .map((s) => {
        const programs =
          filter === 'all'
            ? s.programs
            : filter === 'taken'
              ? s.programs.filter((p) => p.count > 0)
              : s.programs.filter((p) => p.count === 0);
        return { ...s, programs };
      })
      .filter((s) => s.programs.length > 0);
  }, [data, filter]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.series.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          <p>プログラムデータがありません</p>
        </CardContent>
      </Card>
    );
  }

  const percentage = data.summary.total > 0
    ? Math.round((data.summary.taken / data.summary.total) * 100)
    : 0;

  const filterButtons: { mode: FilterMode; label: string }[] = [
    { mode: 'all', label: 'すべて' },
    { mode: 'taken', label: '受講済' },
    { mode: 'untaken', label: '未受講' },
  ];

  return (
    <div className="space-y-4">
      {/* サマリーカード */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-base font-medium text-foreground">
              <span className="text-2xl font-bold">{data.summary.taken}</span>
              {' / '}
              <span>{data.summary.total}</span>
              {' プログラム受講済'}
            </p>
            <span className="text-base font-bold text-foreground">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-3" />
        </CardContent>
      </Card>

      {/* フィルター */}
      <div className="flex gap-2">
        {filterButtons.map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === mode
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground active:bg-muted/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* シリーズ別アコーディオン */}
      {filteredSeries.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            <p>条件に一致するプログラムはありません</p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filteredSeries.map((series) => {
            const seriesTaken = series.programs.filter((p) => p.count > 0).length;
            const seriesTotal = series.programs.length;
            return (
              <AccordionItem
                key={series.seriesName}
                value={series.seriesName}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="text-base py-3">
                  <div className="flex items-center justify-between w-full pr-2">
                    <span className="font-medium text-foreground">{series.seriesName}</span>
                    <span className="text-sm text-muted-foreground">
                      {seriesTaken} / {seriesTotal}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-3 gap-2 pb-2">
                    {series.programs.map((program) => (
                      <div
                        key={program.name}
                        className={`rounded-lg px-2 py-2 text-center ${
                          program.count === 0 ? 'bg-muted' : ''
                        }`}
                        style={
                          program.count > 0
                            ? {
                                backgroundColor: program.colorCode,
                                color: program.textColor,
                              }
                            : undefined
                        }
                      >
                        <p className={`text-sm font-medium truncate ${
                          program.count === 0 ? 'text-muted-foreground' : ''
                        }`}>
                          {program.name}
                        </p>
                        {program.count > 0 && (
                          <p className="text-xs mt-0.5 opacity-90">
                            {program.count}回
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
