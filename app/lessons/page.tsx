"use client";

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import type { Lesson, FilterPreset } from "@/types";
import { parseHomeStoreToStudio } from "@/lib/lessonUtils";
import { cn } from "@/lib/utils";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useFilterPresets } from "@/hooks/useFilterPresets";
import { useWaitlist } from "@/hooks/useWaitlist";
import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import FilterBar, { type FilterState } from "@/components/lessons/FilterBar";
import CalendarView from "@/components/lessons/CalendarView";
import LessonDetailModal from "@/components/lessons/LessonDetailModal";
import type { ReserveApiResult } from "@/components/lessons/LessonDetailModal";
import StudioSelectDialog from "@/components/lessons/StudioSelectDialog";

const LOCALSTORAGE_KEY = 'feelHub_defaultStudio';

const DEFAULT_FILTERS: FilterState = {
  studios: [],
  programs: [],
  instructors: [],
  ticketFilter: "ALL",
  bookmarkOnly: false,
};

export default function LessonsPage() {
  return (
    <Suspense>
      <LessonsPageInner />
    </Suspense>
  );
}

function LessonsPageInner() {
  const searchParams = useSearchParams();
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const { user } = useAuthContext();
  const { bookmarks, toggle, isBookmarked, loaded: bookmarksLoaded } = useBookmarks();
  const { preset, savePreset, deletePreset, isLoaded: presetsLoaded } = useFilterPresets();
  const { isOnWaitlist, getAutoReserve, addToWaitlist, removeFromWaitlist, toggleAutoReserve } = useWaitlist();

  // デフォルトスタジオ解決
  const [defaultStudios, setDefaultStudios] = useState<string[]>([]);
  const [showStudioDialog, setShowStudioDialog] = useState(false);
  const studioResolvedRef = useRef(false);
  const profileHomeStore = useRef<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const prevStudiosRef = useRef<string[] | undefined>(undefined);
  const reservedStudiosRef = useRef<string[]>([]);
  const bookmarkedStudiosRef = useRef<string[]>([]);
  const bookmarksFetchedRef = useRef(false);

  // モーダル状態
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [hasLineUserId, setHasLineUserId] = useState(false);
  const [hasFcSession, setHasFcSession] = useState(false);
  // グループ
  const [groups, setGroups] = useState<Array<{ id: string; name: string; memberCount: number }>>([]);

  const handleTapLesson = useCallback((lesson: Lesson) => {
    setSelectedLesson(lesson);
    setModalOpen(true);
  }, []);

  const handleReserve = useCallback(async (sidHash: string, sheetNo: string): Promise<ReserveApiResult> => {
    const res = await fetch('/api/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sidHash, sheetNo }),
    });
    return res.json();
  }, []);

  const handleInviteGroup = useCallback(async (groupId: string, lesson: Lesson): Promise<{ sent: number; total: number }> => {
    const res = await fetch(`/api/groups/${groupId}/invite-lesson`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        programName: lesson.programName,
        date: lesson.date,
        startTime: lesson.startTime,
        endTime: lesson.endTime,
        instructor: lesson.instructor,
        studio: lesson.studio,
      }),
    });
    if (!res.ok) throw new Error('Failed to invite');
    return res.json();
  }, []);

  // レッスン取得（スタジオ指定 + 予約スタジオも含める）
  const fetchLessons = useCallback(async (studios: string[], background = false) => {
    try {
      if (!background) setLoading(true);
      setError(null);
      const allStudios = studios.length > 0
        ? [...new Set([...studios, ...reservedStudiosRef.current, ...bookmarkedStudiosRef.current])]
        : [];
      const params = allStudios.length > 0 ? `?studios=${encodeURIComponent(allStudios.join(','))}` : '';
      const response = await fetch(`/api/lessons${params}`);
      const data = await response.json();
      if (data.success) {
        setAllLessons(data.data);
      } else if (!background) {
        setError("レッスン情報の取得に失敗しました");
      }
    } catch {
      if (!background) setError("レッスン情報の取得中にエラーが発生しました");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  // ログイン済み: profile + dashboard を並列取得
  const [reservedMap, setReservedMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!user) {
      setProfileLoaded(true);
      return;
    }
    Promise.all([
      fetch('/api/profile').then(res => res.ok ? res.json() : null).catch(() => null),
      fetch('/api/dashboard').then(res => res.ok ? res.json() : null).catch(() => null),
      fetch('/api/groups').then(res => res.ok ? res.json() : null).catch(() => null),
    ]).then(([profileData, dashboardData, groupsData]) => {
      if (profileData?.profile?.lineUserId) setHasLineUserId(true);
      if (profileData?.profile?.homeStore) {
        profileHomeStore.current = parseHomeStoreToStudio(profileData.profile.homeStore);
      }
      // dashboardのhomeStoreをフォールバック（profileにhome_storeがない場合）
      if (!profileHomeStore.current && dashboardData?.memberSummary?.homeStore) {
        profileHomeStore.current = parseHomeStoreToStudio(dashboardData.memberSummary.homeStore);
      }
      if (dashboardData?.reservations) setHasFcSession(true);
      if (dashboardData?.reservations) {
        const map = new Map<string, string>();
        const studioSet = new Set<string>();
        for (const r of dashboardData.reservations as { date: string; startTime: string; programName: string; instructor: string; sheetNo: string; studio: string }[]) {
          map.set(`${r.date}_${r.startTime}_${r.programName}_${r.instructor}`, r.sheetNo || '');
          if (r.studio) {
            studioSet.add(parseHomeStoreToStudio(r.studio));
          }
        }
        setReservedMap(map);
        reservedStudiosRef.current = [...studioSet];
      }
      if (groupsData?.groups) {
        setGroups(groupsData.groups.map((g: { id: string; name: string; memberCount: number }) => ({
          id: g.id, name: g.name, memberCount: g.memberCount,
        })));
      }
      setProfileLoaded(true);
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

  // ブックマーク済みスタジオ → 初回ロード時に再取得
  useEffect(() => {
    const studios = [...new Set(Object.values(bookmarks).map(b => b.studio).filter(Boolean))];
    const prev = bookmarkedStudiosRef.current;
    bookmarkedStudiosRef.current = studios;
    // ブックマークが初めてロードされ、初回fetchが完了済みなら背景で再取得（ローディング表示なし）
    if (!bookmarksFetchedRef.current && studios.length > 0 && prev.length === 0 && prevStudiosRef.current !== undefined) {
      bookmarksFetchedRef.current = true;
      fetchLessons(prevStudiosRef.current, true);
    }
  }, [bookmarks, fetchLessons]);

  // デフォルトスタジオ解決（presets + profile 両方ロード後、1回のみ）
  useEffect(() => {
    if (!presetsLoaded || !profileLoaded || studioResolvedRef.current) return;
    studioResolvedRef.current = true;

    // URLパラメータのプログラム指定（プリセットより優先）
    const programParam = searchParams.get('program');

    // ① 保存済みプリセット
    if (preset) {
      const studios = preset.filters.studios || [];
      setDefaultStudios(studios);
      if (programParam) {
        // URL指定時: スタジオだけ維持し、他はリセット
        setFilters({ ...DEFAULT_FILTERS, studios, programs: [programParam] });
      } else {
        // 旧形式 programSearch → 新形式 programs に変換
        const pf = preset.filters as FilterPreset['filters'] & { programSearch?: string };
        const programs = pf.programs || [];
        setFilters({ ...pf, programs, bookmarkOnly: false });
      }
      prevStudiosRef.current = studios;
      fetchLessons(studios);
      return;
    }

    // ② homeStore（FC連携）
    if (profileHomeStore.current) {
      const studios = [profileHomeStore.current];
      setDefaultStudios(studios);
      setFilters(f => ({ ...f, studios, ...(programParam ? { programs: [programParam] } : {}) }));
      prevStudiosRef.current = studios;
      fetchLessons(studios);
      return;
    }

    // ③ localStorage
    try {
      const saved = localStorage.getItem(LOCALSTORAGE_KEY);
      if (saved !== null) {
        const val = JSON.parse(saved) as string;
        if (val === '__all__') {
          setDefaultStudios([]);
          if (programParam) setFilters(f => ({ ...f, programs: [programParam] }));
          prevStudiosRef.current = [];
          fetchLessons([]);
        } else {
          const studios = [val];
          setDefaultStudios(studios);
          setFilters(f => ({ ...f, studios, ...(programParam ? { programs: [programParam] } : {}) }));
          prevStudiosRef.current = studios;
          fetchLessons(studios);
        }
        return;
      }
    } catch { /* ignore parse error */ }

    // ④ ダイアログ表示
    setShowStudioDialog(true);
  }, [presetsLoaded, profileLoaded, preset, fetchLessons, searchParams]);

  // スタジオフィルタ変更検知 → API再取得
  useEffect(() => {
    if (prevStudiosRef.current === undefined) return;

    const currentKey = [...filters.studios].sort().join(',');
    const prevKey = [...prevStudiosRef.current].sort().join(',');

    if (currentKey !== prevKey) {
      prevStudiosRef.current = [...filters.studios];
      fetchLessons(filters.studios);
    }
  }, [filters.studios, fetchLessons]);

  // ダイアログ選択時
  const handleStudioSelect = useCallback((studio: string | null) => {
    setShowStudioDialog(false);
    if (studio) {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(studio));
      setDefaultStudios([studio]);
      setFilters(f => ({ ...f, studios: [studio] }));
      prevStudiosRef.current = [studio];
      fetchLessons([studio]);
    } else {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify('__all__'));
      setDefaultStudios([]);
      prevStudiosRef.current = [];
      fetchLessons([]);
    }
  }, [fetchLessons]);

  // 全日付を全レッスンから抽出（フィルタ後もカレンダー列を維持）
  const allDates = useMemo(() => {
    const set = new Set<string>();
    for (const l of allLessons) set.add(l.date);
    return [...set].sort();
  }, [allLessons]);

  // 全プログラム名を全レッスンから抽出
  const allPrograms = useMemo(() => {
    const set = new Set<string>();
    for (const l of allLessons) {
      if (l.programName) set.add(l.programName);
    }
    return [...set].sort();
  }, [allLessons]);

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

  // クライアントサイドフィルタ — 本体一覧用（スタジオフィルタ厳守）
  const filteredLessons = useMemo(() => {
    return allLessons.filter((lesson) => {
      if (filters.studios.length > 0 && !filters.studios.includes(lesson.studio)) return false;
      if (filters.programs.length > 0 && !filters.programs.includes(lesson.programName)) return false;
      if (filters.instructors.length > 0) {
        const lessonIRs = lesson.instructor.split(", ");
        if (!filters.instructors.some((ir) => lessonIRs.includes(ir))) return false;
      }
      if (filters.ticketFilter === "NORMAL" && lesson.ticketType !== null) return false;
      if (filters.ticketFilter === "ADDITIONAL" && lesson.ticketType === null) return false;
      return true;
    });
  }, [allLessons, filters.studios, filters.programs, filters.instructors, filters.ticketFilter]);

  // 固定行用: 予約済み（全スタジオ）
  const reservedLessons = useMemo(() =>
    allLessons.filter(l => isReserved(l)),
    [allLessons, isReserved]
  );

  // 固定行用: ブックマーク済み（全スタジオ、bookmarkON時かつロード完了時のみ）
  const bookmarkedLessons = useMemo(() =>
    filters.bookmarkOnly && bookmarksLoaded ? allLessons.filter(l => isBookmarked(l)) : [],
    [allLessons, filters.bookmarkOnly, bookmarksLoaded, isBookmarked]
  );

  const displayCount = filteredLessons.length;

  // プリセット読み込み
  const handleLoadPreset = useCallback(() => {
    if (preset) {
      const pf = preset.filters as FilterPreset['filters'] & { programSearch?: string };
      setFilters({
        ...pf,
        programs: pf.programs || [],
        bookmarkOnly: false,
      });
    }
  }, [preset]);

  // プリセット削除
  const handleDeletePreset = useCallback(() => {
    deletePreset();
    setFilters(f => ({ ...DEFAULT_FILTERS, studios: defaultStudios, bookmarkOnly: f.bookmarkOnly }));
  }, [deletePreset, defaultStudios]);

  // プリセット保存（現在の条件で保存/上書き）
  const handleSavePreset = useCallback(() => {
    savePreset({
      studios: filters.studios,
      programs: filters.programs,
      instructors: filters.instructors,
      ticketFilter: filters.ticketFilter,
    });
  }, [filters, savePreset]);

  // フィルタパネル開閉
  const [filterOpen, setFilterOpen] = useState(false);

  // ツールバー要素（CalendarViewのスロットに渡す）
  const toolbarLeft = (
    <Button
      variant={filters.bookmarkOnly ? "default" : "outline"}
      size="sm"
      className={cn(
        "h-8 text-xs gap-1.5 px-2 sm:px-3",
        filters.bookmarkOnly && "bg-yellow-500 active:bg-yellow-600 text-white border-yellow-500"
      )}
      onClick={() => setFilters((f) => ({ ...f, bookmarkOnly: !f.bookmarkOnly }))}
    >
      <Star className={cn("h-3.5 w-3.5", filters.bookmarkOnly && "fill-white")} />
      ブックマーク
    </Button>
  );

  const filterPanel = (
    <FilterBar
      hideToolbar
      open={filterOpen}
      onOpenChange={setFilterOpen}
      filters={filters}
      onChange={setFilters}
      allPrograms={allPrograms}
      allInstructors={allInstructors}
      preset={preset}
      onLoadPreset={handleLoadPreset}
      onSavePreset={handleSavePreset}
      onDeletePreset={handleDeletePreset}
    />
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

        {/* カレンダー（ツールバー統合） */}
        {!loading && !error && (
          <CalendarView
            lessons={filteredLessons}
            allDates={allDates}
            reservedLessons={reservedLessons}
            bookmarkedLessons={bookmarkedLessons}
            isBookmarked={isBookmarked}
            onToggleBookmark={toggle}
            isReserved={isReserved}
            getSheetNo={getSheetNo}
            isOnWaitlist={isOnWaitlist}
            onTapLesson={handleTapLesson}
            bookmarkOnly={filters.bookmarkOnly}
            toolbarLeft={toolbarLeft}
            middleContent={filterPanel}
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
          onReserve={handleReserve}
          waitlistAutoReserve={selectedLesson ? getAutoReserve(selectedLesson.id) : false}
          onToggleAutoReserve={toggleAutoReserve}
          groups={groups}
          onInviteGroup={handleInviteGroup}
        />
        {/* スタジオ選択ダイアログ */}
        <StudioSelectDialog
          open={showStudioDialog}
          onSelect={handleStudioSelect}
        />
      </div>
    </div>
  );
}
