'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useAuthContext } from '@/contexts/AuthContext';
import type { FilterPreset } from '@/types';

const MAX_PRESETS = 10;

/**
 * フィルタープリセット管理フック
 *
 * ログイン時: サーバーAPI経由でSupabase管理（認証はサーバー側で確実に処理）
 * 未ログイン時: localStorage管理
 *
 * 旧実装の問題点:
 * - クライアント側Supabase直クエリでRLSがセッション未準備時に空データを返す
 * - save/update/deleteがfire-and-forget（失敗検知なし）
 * - cancelled flagのレースコンディション
 */
export function useFilterPresets() {
  const { user } = useAuthContext();
  const [localPresets, setLocalPresets, localLoaded] = useLocalStorage<FilterPreset[]>('feelhub_presets', []);
  const [cloudPresets, setCloudPresets] = useState<FilterPreset[]>([]);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const migrated = useRef(false);
  const loadingRef = useRef(false);

  const userId = user?.id;
  const presets = userId ? cloudPresets : localPresets;
  const isLoaded = userId ? cloudLoaded : localLoaded;

  // ログイン時: APIからプリセット読み込み
  useEffect(() => {
    if (!userId) {
      setCloudLoaded(false);
      return;
    }

    let active = true;
    loadingRef.current = true;

    const load = async (attempt = 0) => {
      try {
        const res = await fetch('/api/filter-presets');
        if (!active) return;

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!active) return;

        if (data.error) {
          throw new Error(data.error);
        }

        setCloudPresets(data.presets || []);
        setCloudLoaded(true);
      } catch (err) {
        if (!active) return;
        console.error('[useFilterPresets] load error:', err);
        // 最大2回リトライ
        if (attempt < 2) {
          setTimeout(() => load(attempt + 1), 1000 * (attempt + 1));
        } else {
          // リトライ上限: 既存データを維持して loaded にする
          setCloudLoaded(true);
        }
      } finally {
        loadingRef.current = false;
      }
    };

    load();
    return () => { active = false; };
  }, [userId]);

  // ログイン直後: localStorageからAPI経由でマイグレーション
  useEffect(() => {
    if (!userId || !cloudLoaded || migrated.current) return;
    migrated.current = true;

    if (localPresets.length === 0) return;

    const migrate = async () => {
      try {
        const res = await fetch('/api/filter-presets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'migrate', presets: localPresets }),
        });
        const data = await res.json();
        if (res.ok && data.presets) {
          // マイグレーション成功: サーバーから確認済みデータで更新してからローカルをクリア
          setCloudPresets(data.presets);
          setLocalPresets([]);
        }
        // 失敗時はローカルデータを維持（次回再試行）
      } catch {
        // 失敗時はローカルデータを維持
      }
    };
    migrate();
  }, [userId, cloudLoaded, localPresets, setLocalPresets]);

  // API呼び出しヘルパー（エラー時に楽観的更新をロールバック）
  const apiCall = useCallback(async (
    body: Record<string, unknown>,
    optimistic: () => void,
    rollback: () => void,
  ) => {
    optimistic();
    try {
      const res = await fetch('/api/filter-presets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('[useFilterPresets] API error:', data.error || res.status);
        rollback();
      }
    } catch {
      console.error('[useFilterPresets] network error');
      rollback();
    }
  }, []);

  const save = useCallback(
    (preset: FilterPreset) => {
      if (userId) {
        const prevPresets = [...cloudPresets];
        apiCall(
          { action: 'save', preset },
          () => setCloudPresets((prev) => {
            const filtered = prev.filter((p) => p.id !== preset.id);
            return [...filtered, preset].slice(-MAX_PRESETS);
          }),
          () => setCloudPresets(prevPresets),
        );
      } else {
        setLocalPresets((prev) => {
          const filtered = prev.filter((p) => p.id !== preset.id);
          return [...filtered, preset].slice(-MAX_PRESETS);
        });
      }
    },
    [userId, cloudPresets, setLocalPresets, apiCall]
  );

  const update = useCallback(
    (id: string, newFilters: FilterPreset['filters']) => {
      if (userId) {
        const prevPresets = [...cloudPresets];
        apiCall(
          { action: 'update', id, filters: newFilters },
          () => setCloudPresets((prev) =>
            prev.map((p) => (p.id === id ? { ...p, filters: newFilters } : p))
          ),
          () => setCloudPresets(prevPresets),
        );
      } else {
        setLocalPresets((prev) =>
          prev.map((p) => (p.id === id ? { ...p, filters: newFilters } : p))
        );
      }
    },
    [userId, cloudPresets, setLocalPresets, apiCall]
  );

  const remove = useCallback(
    (id: string) => {
      if (userId) {
        const prevPresets = [...cloudPresets];
        apiCall(
          { action: 'delete', id },
          () => setCloudPresets((prev) => prev.filter((p) => p.id !== id)),
          () => setCloudPresets(prevPresets),
        );
      } else {
        setLocalPresets((prev) => prev.filter((p) => p.id !== id));
      }
    },
    [userId, cloudPresets, setLocalPresets, apiCall]
  );

  const setDefault = useCallback(
    (id: string | null) => {
      if (userId) {
        const prevPresets = [...cloudPresets];
        apiCall(
          { action: 'setDefault', id },
          () => setCloudPresets((prev) =>
            prev.map((p) => ({ ...p, isDefault: p.id === id }))
          ),
          () => setCloudPresets(prevPresets),
        );
      } else {
        setLocalPresets((prev) =>
          prev.map((p) => ({ ...p, isDefault: p.id === id }))
        );
      }
    },
    [userId, cloudPresets, setLocalPresets, apiCall]
  );

  const rename = useCallback(
    (id: string, newName: string) => {
      if (userId) {
        const prevPresets = [...cloudPresets];
        apiCall(
          { action: 'rename', id, name: newName },
          () => setCloudPresets((prev) =>
            prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
          ),
          () => setCloudPresets(prevPresets),
        );
      } else {
        setLocalPresets((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
        );
      }
    },
    [userId, cloudPresets, setLocalPresets, apiCall]
  );

  return { presets, save, update, remove, rename, setDefault, isLoaded };
}
