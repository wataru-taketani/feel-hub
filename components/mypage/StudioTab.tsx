'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, ChevronDown, Star, Save, Loader2, MapPin } from 'lucide-react';
import { formatStudio } from '@/lib/lessonUtils';
import type { AttendanceRecord } from '@/types';

type ProgramColorMap = Record<string, { colorCode: string; textColor: string }>;

interface StudioRanking {
  name: string;
  count: number;
}

interface StudioTabProps {
  programColors: ProgramColorMap;
}

export default function StudioTab({ programColors }: StudioTabProps) {
  const [studioRanking, setStudioRanking] = useState<StudioRanking[]>([]);
  const [preferences, setPreferences] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedStudio, setExpandedStudio] = useState<string | null>(null);

  // 展開中スタジオの詳細
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [seatCounts, setSeatCounts] = useState<{ seat: string; count: number }[]>([]);

  // お気に入り席編集
  const [editInput, setEditInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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
        setStudioRanking(statsData.studioRanking || []);
        setPreferences(prefsData.preferences || {});
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // スタジオ展開時: 最近の受講取得 + よく使う席集計
  const handleExpand = useCallback(async (studio: string) => {
    if (expandedStudio === studio) {
      setExpandedStudio(null);
      return;
    }
    setExpandedStudio(studio);
    setRecentLoading(true);
    setRecentRecords([]);
    setSeatCounts([]);
    setSaveMessage(null);
    setEditInput((preferences[studio] || []).join(', '));

    try {
      const res = await fetch(`/api/history?store=${encodeURIComponent(studio)}`);
      const data = await res.json();
      const records: AttendanceRecord[] = data.records || [];

      // 最近5件
      setRecentRecords(records.slice(0, 5));

      // よく使う席集計
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
  }, [expandedStudio, preferences]);

  // お気に入り席保存
  const handleSave = async (studio: string) => {
    setSaving(true);
    setSaveMessage(null);
    const seatNumbers = editInput
      .split(/[,、\s]+/)
      .map(s => s.replace(/^#/, '').trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/seat-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studio, seatNumbers }),
      });
      if (!res.ok) throw new Error();
      setPreferences(prev => {
        const next = { ...prev };
        if (seatNumbers.length === 0) {
          delete next[studio];
        } else {
          next[studio] = seatNumbers;
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

  if (studioRanking.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <p>受講履歴がありません</p>
          <p className="text-xs mt-1">マイページ → 履歴タブで同期してください</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-muted-foreground">スタジオ別情報</p>
      {studioRanking.map(({ name: studio, count }) => {
        const isExpanded = expandedStudio === studio;
        const favSeats = preferences[studio];

        return (
          <Card key={studio} className="overflow-hidden">
            {/* ヘッダー行 */}
            <button
              className="w-full text-left p-3 active:bg-muted/50 transition-colors"
              onClick={() => handleExpand(studio)}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{formatStudio(studio)}</span>
                    <Badge variant="secondary" className="text-xs">{count}回</Badge>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 text-yellow-500" />
                    {favSeats && favSeats.length > 0
                      ? favSeats.map(s => `#${s}`).join(' ')
                      : '未設定'}
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

                {/* お気に入り席編集 */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">お気に入り席</p>
                  <div className="flex gap-2">
                    <Input
                      value={editInput}
                      onChange={(e) => {
                        setEditInput(e.target.value);
                        setSaveMessage(null);
                      }}
                      placeholder="14, 15, 22"
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0"
                      onClick={() => handleSave(studio)}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
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
                        <p className="text-xs font-medium text-muted-foreground">よく使う席</p>
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
        );
      })}
    </div>
  );
}
