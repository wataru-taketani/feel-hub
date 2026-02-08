"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { Lesson, FilterPreset } from "@/types";
import { matchesProgram } from "@/lib/lessonUtils";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useFilterPresets } from "@/hooks/useFilterPresets";
import FilterBar, { type FilterState } from "@/components/lessons/FilterBar";
import CalendarView from "@/components/lessons/CalendarView";

const DEFAULT_FILTERS: FilterState = {
  studios: ["渋谷"],
  programSearch: "",
  instructors: [],
  ticketFilter: "ALL",
  bookmarkOnly: false,
};

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const { toggle, isBookmarked } = useBookmarks();
  const { presets, save: savePreset, update: updatePreset, remove: removePreset } = useFilterPresets();

  // スタジオが変わったらAPI再fetch
  useEffect(() => {
    if (filters.studios.length === 0) {
      setLessons([]);
      setLoading(false);
      return;
    }

    const fetchLessons = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        for (const s of filters.studios) {
          params.append("studio", s);
        }

        const response = await fetch(`/api/lessons?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
          setLessons(data.data);
        } else {
          setError("レッスン情報の取得に失敗しました");
        }
      } catch {
        setError("レッスン情報の取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchLessons();
  }, [filters.studios]);

  // 全IR一覧（取得済みデータから抽出）
  const allInstructors = useMemo(() => {
    const set = new Set(lessons.map((l) => l.instructor));
    return [...set].sort();
  }, [lessons]);

  // クライアントサイドフィルタ
  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      if (!matchesProgram(lesson.programName, filters.programSearch)) return false;
      if (filters.instructors.length > 0 && !filters.instructors.includes(lesson.instructor)) return false;
      if (filters.ticketFilter === "NORMAL" && lesson.ticketType !== null) return false;
      if (filters.ticketFilter === "ADDITIONAL" && lesson.ticketType === null) return false;
      if (filters.bookmarkOnly && !isBookmarked(lesson)) return false;
      return true;
    });
  }, [lessons, filters.programSearch, filters.instructors, filters.ticketFilter, filters.bookmarkOnly, isBookmarked]);

  // プリセット読み込み
  const handleLoadPreset = useCallback(
    (preset: FilterPreset) => {
      setFilters({
        ...preset.filters,
        bookmarkOnly: false,
      });
    },
    []
  );

  // プリセット保存
  const handleSavePreset = useCallback(
    (name: string) => {
      savePreset({
        id: crypto.randomUUID(),
        name,
        filters: {
          studios: filters.studios,
          programSearch: filters.programSearch,
          instructors: filters.instructors,
          ticketFilter: filters.ticketFilter,
        },
      });
    },
    [filters, savePreset]
  );

  // プリセット更新
  const handleUpdatePreset = useCallback(
    (id: string) => {
      updatePreset(id, {
        studios: filters.studios,
        programSearch: filters.programSearch,
        instructors: filters.instructors,
        ticketFilter: filters.ticketFilter,
      });
    },
    [filters, updatePreset]
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-[1400px] mx-auto px-4 py-3 sm:px-6">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-foreground">Feel Hub</h1>
            <nav className="flex gap-4">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                トップ
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1400px] mx-auto px-4 py-4 sm:px-6">
        {/* タイトル + 件数 */}
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-lg font-bold text-foreground">レッスン一覧</h2>
          {!loading && (
            <span className="text-sm text-muted-foreground">
              {filteredLessons.length} 件
              {filteredLessons.length !== lessons.length && ` / ${lessons.length} 件中`}
            </span>
          )}
        </div>

        {/* フィルタバー */}
        <div className="mb-4">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            allInstructors={allInstructors}
            presets={presets}
            onLoadPreset={handleLoadPreset}
            onSavePreset={handleSavePreset}
            onUpdatePreset={handleUpdatePreset}
            onDeletePreset={removePreset}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-lg border bg-card shadow-sm p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">レッスン情報を読み込み中...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* スタジオ未選択 */}
        {!loading && !error && filters.studios.length === 0 && (
          <div className="rounded-lg border bg-card shadow-sm p-12 text-center">
            <p className="text-muted-foreground">スタジオを選択してください</p>
          </div>
        )}

        {/* カレンダー */}
        {!loading && !error && filters.studios.length > 0 && (
          <CalendarView
            lessons={filteredLessons}
            isBookmarked={isBookmarked}
            onToggleBookmark={toggle}
          />
        )}
      </main>
    </div>
  );
}
