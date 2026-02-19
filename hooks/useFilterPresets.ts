'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useAuthContext } from '@/contexts/AuthContext';
import type { FilterPreset } from '@/types';

/**
 * フィルタープリセット管理フック（ユーザーごとに1つ）
 *
 * ログイン時: サーバーAPI経由でSupabase管理
 * 未ログイン時: localStorage管理
 */
export function useFilterPresets() {
  const { user } = useAuthContext();
  const [localPreset, setLocalPreset, localLoaded] = useLocalStorage<FilterPreset | null>('feelhub_presets', null);
  const [cloudPreset, setCloudPreset] = useState<FilterPreset | null>(null);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const migrated = useRef(false);
  const loadingRef = useRef(false);

  const userId = user?.id;
  const preset = userId ? cloudPreset : localPreset;
  const isLoaded = userId ? cloudLoaded : localLoaded;

  // 旧配列データのマイグレーション（localStorage）
  useEffect(() => {
    if (!localLoaded) return;
    try {
      const raw = window.localStorage.getItem('feelhub_presets');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // 旧形式: 配列 → デフォルトまたは先頭の1つだけを移行
        const defaultOne = parsed.find((p: { isDefault?: boolean }) => p.isDefault) || parsed[0];
        if (defaultOne) {
          const migrated: FilterPreset = { id: defaultOne.id, filters: defaultOne.filters };
          setLocalPreset(migrated);
        } else {
          setLocalPreset(null);
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localLoaded]);

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

        setCloudPreset(data.preset || null);
        setCloudLoaded(true);
      } catch (err) {
        if (!active) return;
        console.error('[useFilterPresets] load error:', err);
        if (attempt < 2) {
          setTimeout(() => load(attempt + 1), 1000 * (attempt + 1));
        } else {
          setCloudLoaded(true);
        }
      } finally {
        loadingRef.current = false;
      }
    };

    load();
    return () => { active = false; };
  }, [userId]);

  // ログイン直後: localStorageからマイグレーション
  useEffect(() => {
    if (!userId || !cloudLoaded || migrated.current) return;
    migrated.current = true;

    if (!localPreset) return;

    const migrate = async () => {
      try {
        const res = await fetch('/api/filter-presets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters: localPreset.filters }),
        });
        if (res.ok) {
          setCloudPreset(localPreset);
          setLocalPreset(null);
        }
      } catch {
        // 失敗時はローカルデータを維持
      }
    };
    // クラウドに既存データがなければマイグレーション
    if (!cloudPreset) {
      migrate();
    }
  }, [userId, cloudLoaded, localPreset, cloudPreset, setLocalPreset]);

  // API呼び出しヘルパー（楽観的更新 + ロールバック）
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

  const savePreset = useCallback(
    (filters: FilterPreset['filters']) => {
      const newPreset: FilterPreset = {
        id: preset?.id || crypto.randomUUID(),
        filters,
      };

      if (userId) {
        const prevPreset = cloudPreset;
        apiCall(
          { filters },
          () => setCloudPreset(newPreset),
          () => setCloudPreset(prevPreset),
        );
      } else {
        setLocalPreset(newPreset);
      }
    },
    [userId, cloudPreset, preset, setLocalPreset, apiCall]
  );

  return { preset, savePreset, isLoaded };
}
