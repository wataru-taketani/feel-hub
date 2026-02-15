'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface SeatMapBike {
  x: number;
  y: number;
  status: number; // 1=available, 2=reserved(others), 3=reserved(mine)
}

interface SeatMapResponse {
  bikes: Record<string, SeatMapBike>;
  instructor: { x: number; y: number } | null;
  mapImageUrl: string;
  mapWidth: number;
  mapHeight: number;
  instructorImageUrl: string;
}

interface SeatMapProps {
  sidHash: string;
}

// status → スタイル
function bikeStyle(status: number) {
  if (status === 1) {
    // 予約可能（空き）
    return 'bg-white border-2 border-gray-400 text-gray-700';
  }
  if (status === 3) {
    // 自分の予約
    return 'bg-pink-400 border-2 border-pink-500 text-white';
  }
  // status === 2 or other: 予約済（他の人）
  return 'bg-gray-600 border border-gray-500 text-gray-300';
}

export default function SeatMap({ sidHash }: SeatMapProps) {
  const [data, setData] = useState<SeatMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSeatMap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/seatmap?sidHash=${encodeURIComponent(sidHash)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.code === 'FC_SESSION_EXPIRED') {
          setError('FCセッション切れ。マイページで再連携してください');
        } else {
          setError('座席マップを取得できませんでした');
        }
        return;
      }
      const json: SeatMapResponse = await res.json();
      setData(json);
    } catch {
      setError('座席マップを取得できませんでした');
    } finally {
      setLoading(false);
    }
  }, [sidHash]);

  useEffect(() => {
    fetchSeatMap();
  }, [fetchSeatMap]);

  if (loading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">座席マップ</p>
        <Skeleton className="w-full h-48 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">座席マップ</p>
        <p className="text-xs text-destructive">{error}</p>
      </div>
    );
  }

  if (!data || Object.keys(data.bikes).length === 0) {
    return null;
  }

  const bikes = Object.entries(data.bikes);
  const availableCount = bikes.filter(([, b]) => b.status === 1).length;
  const totalCount = bikes.length;
  const hasMine = bikes.some(([, b]) => b.status === 3);

  // バイクの丸サイズ（px）
  const BIKE_SIZE = 28;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">座席マップ</p>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={fetchSeatMap}>
          <RefreshCw className="h-3 w-3 mr-1" />
          更新
        </Button>
      </div>

      {/* 座席マップ */}
      <div
        className="relative w-full rounded-lg overflow-hidden bg-gray-900"
        style={{ aspectRatio: `${data.mapWidth} / ${data.mapHeight}` }}
      >
        {/* 背景画像 */}
        {data.mapImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.mapImageUrl}
            alt="Studio layout"
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}

        {/* インストラクター位置 */}
        {data.instructor && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              left: `${(data.instructor.x / data.mapWidth) * 100}%`,
              top: `${(data.instructor.y / data.mapHeight) * 100}%`,
              width: BIKE_SIZE,
              height: BIKE_SIZE,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="text-[9px] font-bold text-yellow-400 bg-black/60 rounded px-1">IR</span>
          </div>
        )}

        {/* バイク配置 */}
        {bikes.map(([bikeNo, bike]) => (
          <div
            key={bikeNo}
            className={`absolute flex items-center justify-center rounded-full ${bikeStyle(bike.status)}`}
            style={{
              left: `${(bike.x / data.mapWidth) * 100}%`,
              top: `${(bike.y / data.mapHeight) * 100}%`,
              width: BIKE_SIZE,
              height: BIKE_SIZE,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span className="text-[9px] font-bold leading-none">{bikeNo}</span>
          </div>
        ))}
      </div>

      {/* 凡例 + カウント */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-white border-2 border-gray-400" />
            空き
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-gray-600 border border-gray-500" />
            予約済
          </span>
          {hasMine && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-pink-400 border-2 border-pink-500" />
              自分
            </span>
          )}
        </div>
        <span className="font-medium">
          空き {availableCount} / {totalCount} 台
        </span>
      </div>
    </div>
  );
}
