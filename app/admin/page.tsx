"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import type { Lesson } from "@/types";

export default function AdminPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フィルター
  const [studioFilter, setStudioFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [instructorFilter, setInstructorFilter] = useState("");
  const [fullFilter, setFullFilter] = useState<"all" | "full" | "available">("all");
  const [includePast, setIncludePast] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchAll();
  }, [includePast]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (includePast) params.set("includePast", "true");
      const res = await fetch(`/api/lessons?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLessons(data.data);
        setTotalCount(data.totalCount ?? data.count);
      } else {
        setError("データの取得に失敗しました");
      }
    } catch (err) {
      setError("データの取得中にエラーが発生しました");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ユニーク値の抽出（フィルタ用）
  const studios = useMemo(
    () => [...new Set(lessons.map((l) => l.studio))].sort(),
    [lessons]
  );
  const dates = useMemo(
    () => [...new Set(lessons.map((l) => l.date))].sort(),
    [lessons]
  );
  const instructors = useMemo(
    () => [...new Set(lessons.map((l) => l.instructor))].sort(),
    [lessons]
  );

  // フィルタ適用
  const filtered = useMemo(() => {
    return lessons.filter((l) => {
      if (studioFilter && l.studio !== studioFilter) return false;
      if (dateFilter && l.date !== dateFilter) return false;
      if (programFilter && !l.programName.toLowerCase().includes(programFilter.toLowerCase())) return false;
      if (instructorFilter && l.instructor !== instructorFilter) return false;
      if (fullFilter === "full" && !l.isFull) return false;
      if (fullFilter === "available" && l.isFull) return false;
      return true;
    });
  }, [lessons, studioFilter, dateFilter, programFilter, instructorFilter, fullFilter]);

  // 統計
  const stats = useMemo(() => {
    const studioCount: Record<string, number> = {};
    const dateCount: Record<string, number> = {};
    let fullCount = 0;
    filtered.forEach((l) => {
      studioCount[l.studio] = (studioCount[l.studio] || 0) + 1;
      dateCount[l.date] = (dateCount[l.date] || 0) + 1;
      if (l.isFull) fullCount++;
    });
    return {
      total: filtered.length,
      studioCount: Object.entries(studioCount).sort((a, b) => b[1] - a[1]),
      dateCount: Object.entries(dateCount).sort(),
      fullCount,
      availableCount: filtered.length - fullCount,
    };
  }, [filtered]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const days = ["日", "月", "火", "水", "木", "金", "土"];
    return `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
  };

  const clearFilters = () => {
    setStudioFilter("");
    setDateFilter("");
    setProgramFilter("");
    setInstructorFilter("");
    setFullFilter("all");
    setIncludePast(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gray-900 text-white shadow">
        <div className="max-w-full mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-lg font-bold">Feel Hub - DB Viewer</h1>
          <nav className="flex gap-4 text-sm">
            <Link href="/" className="hover:text-gray-300">トップ</Link>
            <Link href="/lessons" className="hover:text-gray-300">レッスン一覧</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-full mx-auto px-4 py-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded shadow p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{loading ? "..." : stats.total}</div>
            <div className="text-xs text-gray-500">フィルタ後の件数</div>
          </div>
          <div className="bg-white rounded shadow p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{loading ? "..." : totalCount}</div>
            <div className="text-xs text-gray-500">全レッスン数</div>
          </div>
          <div className="bg-white rounded shadow p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{loading ? "..." : stats.availableCount}</div>
            <div className="text-xs text-gray-500">空きあり</div>
          </div>
          <div className="bg-white rounded shadow p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{loading ? "..." : stats.fullCount}</div>
            <div className="text-xs text-gray-500">満席</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded shadow p-3 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">スタジオ</label>
              <select
                value={studioFilter}
                onChange={(e) => setStudioFilter(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm w-36 text-gray-900"
              >
                <option value="">全て ({studios.length})</option>
                {studios.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">日付</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm w-36 text-gray-900"
              >
                <option value="">全日程 ({dates.length}日)</option>
                {dates.map((d) => (
                  <option key={d} value={d}>{formatDate(d)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">プログラム名</label>
              <input
                type="text"
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                placeholder="例: BB1, BSW"
                className="border rounded px-2 py-1.5 text-sm w-36 text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">インストラクター</label>
              <select
                value={instructorFilter}
                onChange={(e) => setInstructorFilter(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm w-36 text-gray-900"
              >
                <option value="">全て ({instructors.length}名)</option>
                {instructors.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">空き状況</label>
              <select
                value={fullFilter}
                onChange={(e) => setFullFilter(e.target.value as "all" | "full" | "available")}
                className="border rounded px-2 py-1.5 text-sm w-28 text-gray-900"
              >
                <option value="all">全て</option>
                <option value="available">空きあり</option>
                <option value="full">満席</option>
              </select>
            </div>
            <label className="flex items-center gap-1.5 pb-1 cursor-pointer">
              <input
                type="checkbox"
                checked={includePast}
                onChange={(e) => setIncludePast(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">過去データを含む</span>
            </label>
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 underline pb-1"
            >
              リセット
            </button>
          </div>
        </div>

        {/* Studio breakdown (collapsible) */}
        {!loading && stats.studioCount.length > 1 && (
          <details className="bg-white rounded shadow p-3 mb-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              スタジオ別件数 ({stats.studioCount.length} スタジオ)
            </summary>
            <div className="mt-2 grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-9 gap-1 text-xs">
              {stats.studioCount.map(([studio, count]) => (
                <button
                  key={studio}
                  onClick={() => setStudioFilter(studio)}
                  className="bg-gray-50 hover:bg-blue-50 rounded px-2 py-1 text-left truncate"
                >
                  <span className="font-medium">{studio}</span>
                  <span className="text-gray-400 ml-1">{count}</span>
                </button>
              ))}
            </div>
          </details>
        )}

        {/* Loading / Error */}
        {loading && (
          <div className="bg-white rounded shadow p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto" />
            <p className="mt-3 text-sm text-gray-500">読み込み中...</p>
          </div>
        )}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">{error}</div>
        )}

        {/* Data Table */}
        {!loading && !error && (
          <div className="bg-white rounded shadow overflow-x-auto">
            <table className="w-full text-sm text-gray-900">
              <thead>
                <tr className="bg-gray-50 border-b text-left text-xs text-gray-600 uppercase font-semibold">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">日付</th>
                  <th className="px-3 py-2">時間</th>
                  <th className="px-3 py-2">プログラム</th>
                  <th className="px-3 py-2">インストラクター</th>
                  <th className="px-3 py-2">スタジオ</th>
                  <th className="px-3 py-2">空き</th>
                  <th className="px-3 py-2">チケット</th>
                  <th className="px-3 py-2 text-gray-300">ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((lesson, idx) => (
                  <tr
                    key={lesson.id}
                    className={`border-b hover:bg-gray-50 ${idx % 2 === 0 ? "" : "bg-gray-50/50"} ${lesson.isPast ? "opacity-50" : ""}`}
                  >
                    <td className="px-3 py-1.5 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(lesson.date)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap font-mono">
                      {lesson.startTime}-{lesson.endTime}
                    </td>
                    <td className="px-3 py-1.5 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {lesson.colorCode && (
                          <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: lesson.colorCode }} />
                        )}
                        {lesson.programName}
                      </span>
                      {lesson.isPast && (
                        <span className="ml-1.5 px-1.5 py-0.5 bg-gray-200 text-gray-500 text-xs rounded">過去</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">{lesson.instructor}</td>
                    <td className="px-3 py-1.5">{lesson.studio}</td>
                    <td className="px-3 py-1.5">
                      {lesson.isFull ? (
                        <span className="text-red-600 font-medium">満席</span>
                      ) : (
                        <span className="text-green-600">空き</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {lesson.ticketType && (
                        <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${
                          lesson.ticketType === 'PLATINUM' ? 'bg-purple-100 text-purple-700' :
                          lesson.ticketType === 'GOLD' ? 'bg-yellow-100 text-yellow-700' :
                          lesson.ticketType === 'SILVER' ? 'bg-gray-200 text-gray-600' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {lesson.ticketType}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-gray-300 text-xs font-mono truncate max-w-[100px]">
                      {lesson.id?.substring(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 500 && (
              <div className="p-3 text-center text-sm text-gray-500 border-t">
                先頭500件を表示中（全{filtered.length}件）。フィルターで絞り込んでください。
              </div>
            )}
            {filtered.length === 0 && (
              <div className="p-8 text-center text-gray-500">該当するレッスンがありません</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
