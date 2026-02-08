'use client';

import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { FilterPreset } from '@/types';

const MAX_PRESETS = 10;

export function useFilterPresets() {
  const [presets, setPresets] = useLocalStorage<FilterPreset[]>('feelhub_presets', []);

  const save = useCallback(
    (preset: FilterPreset) => {
      setPresets((prev) => {
        const filtered = prev.filter((p) => p.id !== preset.id);
        return [...filtered, preset].slice(-MAX_PRESETS);
      });
    },
    [setPresets]
  );

  const update = useCallback(
    (id: string, newFilters: FilterPreset['filters']) => {
      setPresets((prev) =>
        prev.map((p) => (p.id === id ? { ...p, filters: newFilters } : p))
      );
    },
    [setPresets]
  );

  const remove = useCallback(
    (id: string) => {
      setPresets((prev) => prev.filter((p) => p.id !== id));
    },
    [setPresets]
  );

  return { presets, save, update, remove };
}
