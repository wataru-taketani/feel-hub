"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { Lesson, FilterPreset } from "@/types";
import { matchesProgram } from "@/lib/lessonUtils";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useFilterPresets } from "@/hooks/useFilterPresets";
import { useAuthContext } from "@/contexts/AuthContext";
import FilterBar, { type FilterState } from "@/components/lessons/FilterBar";
import CalendarView from "@/components/lessons/CalendarView";

const DEFAULT_FILTERS: FilterState = {
  studios: [],
  programSearch: "",
  instructors: [],
  ticketFilter: "ALL",
  bookmarkOnly: false,
};

export default function LessonsPage() {
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const { user } = useAuthContext();
  const { toggle, isBookmarked } = useBookmarks();
  const { presets, save: savePreset, update: updatePreset, remove: removePreset, setDefault: setDefaultPreset, isLoaded: presetsLoaded } = useFilterPresets();

  const initialPresetApplied = useRef(false);

  // ログイン済みの場合、予約情報を取得（/api/dashboard経由）
  const [reservedKeys, setReservedKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!user) return;
    fetch('/api/dashboard')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data?.reservations) return;
        const keys = new Set<string>(
          data.reservations.map((r: { date: string; startTime: string; programName: string; instructor: string }) =>
            `${r.date}_${r.startTime}_${r.programName}_${r.instructor}`
          )
        );
        setReservedKeys(keys);
      })
      .catch((e) => console.warn('Failed to fetch reservations:', e));
  }, [user]);

  const isReserved = useCallback(
    (lesson: Lesson) => reservedKeys.has(`${lesson.date}_${lesson.startTime}_${lesson.programName}_${lesson.instructor}`),
    [reservedKeys]
  );

  // 全未来レッスンを初回のみ一括取得
  useEffect(() => {
    const fetchAllLessons = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/lessons");
        const data = await response.json();

        if (data.success) {
          setAllLessons(data.data);
        } else {
          setError("レッスン情報の取得に失敗しました");
        }
      } catch {
        setError("レッスン情報の取得中にエラーが発生しました");
      } finally {
        setLoading(false);
      }
    };

    fetchAllLessons();
  }, []);

  // デフォルトプリセット初期適用（presetsロード後、1回のみ）
  useEffect(() => {
    if (!presetsLoaded || initialPresetApplied.current) return;
    initialPresetApplied.current = true;

    const defaultPreset = presets.find((p) => p.isDefault);
    if (defaultPreset) {
      setFilters({ ...defaultPreset.filters, bookmarkOnly: false });
    }
  }, [presetsLoaded, presets]);

  // 全インストラクターを全レッスンから抽出（Wイントラはカンマ区切りで分割）
  const allInstructors = useMemo(() => {
    const set = new Set<string>();
    for (const l of allLessons) {
      if (!l.instructor) continue;
      for (const name of l.instructor.split(", ")) {
        set.add(name);
      }
    }
    return [...set].sort();
  }, [allLessons]);

  // クライアントサイドフィルタ（スタジオ含む）
  const filteredLessons = useMemo(() => {
    return allLessons.filter((lesson) => {
      if (filters.studios.length > 0 && !filters.studios.includes(lesson.studio)) return false;
      if (!matchesProgram(lesson.programName, filters.programSearch)) return false;
      if (filters.instructors.length > 0) {
        const lessonIRs = lesson.instructor.split(", ");
        if (!filters.instructors.some((ir) => lessonIRs.includes(ir))) return false;
      }
      if (filters.ticketFilter === "NORMAL" && lesson.ticketType !== null) return false;
      if (filters.ticketFilter === "ADDITIONAL" && lesson.ticketType === null) return false;
      if (filters.bookmarkOnly && !isBookmarked(lesson)) return false;
      return true;
    });
  }, [allLessons, filters.studios, filters.programSearch, filters.instructors, filters.ticketFilter, filters.bookmarkOnly, isBookmarked]);

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
      <div className="max-w-[1400px] mx-auto px-4 py-4 sm:px-6">
        {/* タイトル + 件数 */}
        <div className="flex items-baseline gap-3 mb-3">
          <h2 className="text-lg font-bold text-foreground">レッスン一覧</h2>
          {!loading && (
            <span className="text-sm text-muted-foreground">
              {filteredLessons.length} 件
              {filteredLessons.length !== allLessons.length && ` / ${allLessons.length} 件中`}
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
            onSetDefaultPreset={setDefaultPreset}
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

        {/* カレンダー */}
        {!loading && !error && (
          <CalendarView
            lessons={filteredLessons}
            isBookmarked={isBookmarked}
            onToggleBookmark={toggle}
            isReserved={isReserved}
          />
        )}
      </div>
    </div>
  );
}
