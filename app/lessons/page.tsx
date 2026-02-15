"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Loader2 } from "lucide-react";
import type { Lesson, FilterPreset } from "@/types";
import { matchesProgram } from "@/lib/lessonUtils";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useFilterPresets } from "@/hooks/useFilterPresets";
import { useWaitlist } from "@/hooks/useWaitlist";
import { useAuthContext } from "@/contexts/AuthContext";
import FilterBar, { type FilterState } from "@/components/lessons/FilterBar";
import CalendarView from "@/components/lessons/CalendarView";
import LessonDetailModal from "@/components/lessons/LessonDetailModal";

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
  const { isOnWaitlist, addToWaitlist, removeFromWaitlist } = useWaitlist();

  const initialPresetApplied = useRef(false);

  // モーダル状態
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [hasLineUserId, setHasLineUserId] = useState(false);
  const [hasFcSession, setHasFcSession] = useState(false);

  const handleTapLesson = useCallback((lesson: Lesson) => {
    setSelectedLesson(lesson);
    setModalOpen(true);
  }, []);

  // ログイン済み: profile + dashboard を並列取得
  // key → sheetNo のマップ（予約済みレッスン + バイク番号）
  const [reservedMap, setReservedMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch('/api/profile').then(res => res.ok ? res.json() : null).catch(() => null),
      fetch('/api/dashboard').then(res => res.ok ? res.json() : null).catch(() => null),
    ]).then(([profileData, dashboardData]) => {
      if (profileData?.profile?.lineUserId) setHasLineUserId(true);
      if (dashboardData?.reservations) setHasFcSession(true);
      if (dashboardData?.reservations) {
        const map = new Map<string, string>();
        for (const r of dashboardData.reservations as { date: string; startTime: string; programName: string; instructor: string; sheetNo: string }[]) {
          map.set(`${r.date}_${r.startTime}_${r.programName}_${r.instructor}`, r.sheetNo || '');
        }
        setReservedMap(map);
      }
    });
  }, [user]);

  const isReserved = useCallback(
    (lesson: Lesson) => reservedMap.has(`${lesson.date}_${lesson.startTime}_${lesson.programName}_${lesson.instructor}`),
    [reservedMap]
  );

  const getSheetNo = useCallback(
    (lesson: Lesson) => reservedMap.get(`${lesson.date}_${lesson.startTime}_${lesson.programName}_${lesson.instructor}`) || null,
    [reservedMap]
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
      return true;
    });
  }, [allLessons, filters.studios, filters.programSearch, filters.instructors, filters.ticketFilter]);

  const displayCount = filters.bookmarkOnly
    ? filteredLessons.filter((l) => isBookmarked(l)).length
    : filteredLessons.length;

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
              {displayCount} 件
              {displayCount !== allLessons.length && ` / ${allLessons.length} 件中`}
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
            getSheetNo={getSheetNo}
            isOnWaitlist={isOnWaitlist}
            onTapLesson={handleTapLesson}
            bookmarkOnly={filters.bookmarkOnly}
          />
        )}
        {/* レッスン詳細モーダル */}
        <LessonDetailModal
          lesson={selectedLesson}
          open={modalOpen}
          onOpenChange={setModalOpen}
          isLoggedIn={!!user}
          hasLineUserId={hasLineUserId}
          hasFcSession={hasFcSession}
          isOnWaitlist={selectedLesson ? isOnWaitlist(selectedLesson.id) : false}
          isReserved={selectedLesson ? isReserved(selectedLesson) : false}
          onAddWaitlist={(lesson, autoReserve) => addToWaitlist(lesson, autoReserve)}
          onRemoveWaitlist={removeFromWaitlist}
        />
      </div>
    </div>
  );
}
