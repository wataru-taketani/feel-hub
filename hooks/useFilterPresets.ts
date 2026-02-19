'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useAuthContext } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import type { FilterPreset } from '@/types';

const MAX_PRESETS = 10;

export function useFilterPresets() {
  const { user } = useAuthContext();
  const [localPresets, setLocalPresets, localLoaded] = useLocalStorage<FilterPreset[]>('feelhub_presets', []);
  const [cloudPresets, setCloudPresets] = useState<FilterPreset[]>([]);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const migrated = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), []);

  const presets = user ? cloudPresets : localPresets;
  const isLoaded = user ? cloudLoaded : localLoaded;

  // ログイン時: Supabaseからプリセット読み込み（リトライ付き）
  useEffect(() => {
    if (!user) {
      setCloudLoaded(false);
      return;
    }

    let cancelled = false;
    let retryCount = 0;
    const MAX_RETRIES = 2;

    const loadPresets = () => {
      supabase
        .from('filter_presets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.error('[useFilterPresets] load error:', error.message);
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              setTimeout(loadPresets, 1000);
              return;
            }
            // リトライ上限: 既存データを維持して loaded にする
            setCloudLoaded(true);
            return;
          }
          const list: FilterPreset[] = (data || []).map((row) => ({
            id: row.id,
            name: row.name,
            isDefault: row.is_default,
            filters: row.filters,
          }));
          setCloudPresets(list);
          setCloudLoaded(true);
        });
    };

    loadPresets();
    return () => { cancelled = true; };
  }, [user, supabase]);

  // ログイン直後: localStorageからSupabaseにマイグレーション
  useEffect(() => {
    if (!user || !cloudLoaded || migrated.current) return;
    migrated.current = true;

    if (localPresets.length === 0) return;

    const rows = localPresets.map((p) => ({
      id: p.id,
      user_id: user.id,
      name: p.name,
      is_default: p.isDefault || false,
      filters: p.filters,
    }));

    supabase
      .from('filter_presets')
      .upsert(rows)
      .then(({ error }) => {
        if (!error) {
          setLocalPresets([]);
          setCloudPresets((prev) => {
            const merged = [...prev];
            for (const p of localPresets) {
              if (!merged.find((m) => m.id === p.id)) {
                merged.push(p);
              }
            }
            return merged.slice(-MAX_PRESETS);
          });
        }
      });
  }, [user, cloudLoaded, localPresets, setLocalPresets, supabase]);

  const save = useCallback(
    (preset: FilterPreset) => {
      if (user) {
        setCloudPresets((prev) => {
          const filtered = prev.filter((p) => p.id !== preset.id);
          return [...filtered, preset].slice(-MAX_PRESETS);
        });
        supabase.from('filter_presets').upsert({
          id: preset.id,
          user_id: user.id,
          name: preset.name,
          is_default: preset.isDefault || false,
          filters: preset.filters,
        });
      } else {
        setLocalPresets((prev) => {
          const filtered = prev.filter((p) => p.id !== preset.id);
          return [...filtered, preset].slice(-MAX_PRESETS);
        });
      }
    },
    [user, setLocalPresets, supabase]
  );

  const update = useCallback(
    (id: string, newFilters: FilterPreset['filters']) => {
      if (user) {
        setCloudPresets((prev) =>
          prev.map((p) => (p.id === id ? { ...p, filters: newFilters } : p))
        );
        supabase.from('filter_presets').update({ filters: newFilters }).eq('id', id).eq('user_id', user.id);
      } else {
        setLocalPresets((prev) =>
          prev.map((p) => (p.id === id ? { ...p, filters: newFilters } : p))
        );
      }
    },
    [user, setLocalPresets, supabase]
  );

  const remove = useCallback(
    (id: string) => {
      if (user) {
        setCloudPresets((prev) => prev.filter((p) => p.id !== id));
        supabase.from('filter_presets').delete().eq('id', id).eq('user_id', user.id);
      } else {
        setLocalPresets((prev) => prev.filter((p) => p.id !== id));
      }
    },
    [user, setLocalPresets, supabase]
  );

  const setDefault = useCallback(
    (id: string | null) => {
      if (user) {
        setCloudPresets((prev) =>
          prev.map((p) => ({ ...p, isDefault: p.id === id }))
        );
        // 全件をis_default=falseにしてから対象をtrueに
        supabase.from('filter_presets').update({ is_default: false }).eq('user_id', user.id).then(() => {
          if (id) {
            supabase.from('filter_presets').update({ is_default: true }).eq('id', id).eq('user_id', user.id);
          }
        });
      } else {
        setLocalPresets((prev) =>
          prev.map((p) => ({ ...p, isDefault: p.id === id }))
        );
      }
    },
    [user, setLocalPresets, supabase]
  );

  const rename = useCallback(
    (id: string, newName: string) => {
      if (user) {
        setCloudPresets((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
        );
        supabase.from('filter_presets').update({ name: newName }).eq('id', id).eq('user_id', user.id);
      } else {
        setLocalPresets((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
        );
      }
    },
    [user, setLocalPresets, supabase]
  );

  return { presets, save, update, remove, rename, setDefault, isLoaded };
}
