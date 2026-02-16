'use client';

import { useState } from 'react';
import { RotateCcw, Star, Search, SlidersHorizontal, ChevronDown, X, MapPin, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import StudioMultiSelect from './StudioMultiSelect';
import InstructorMultiSelect from './InstructorMultiSelect';
import PresetManager from './PresetManager';
import type { FilterPreset } from '@/types';

export interface FilterState {
  studios: string[];
  programSearch: string;
  instructors: string[];
  ticketFilter: 'ALL' | 'NORMAL' | 'ADDITIONAL';
  bookmarkOnly: boolean;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  allInstructors: string[];
  presets: FilterPreset[];
  onLoadPreset: (preset: FilterPreset) => void;
  onSavePreset: (name: string) => void;
  onUpdatePreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onSetDefaultPreset: (id: string | null) => void;
  /** ツールバー行を非表示（親で統合描画する場合） */
  hideToolbar?: boolean;
  /** 外部制御のopen state */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{children}</div>;
}

export default function FilterBar({
  filters,
  onChange,
  allInstructors,
  presets,
  onLoadPreset,
  onSavePreset,
  onUpdatePreset,
  onDeletePreset,
  onSetDefaultPreset,
  hideToolbar,
  open: controlledOpen,
  onOpenChange,
}: FilterBarProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const update = (partial: Partial<FilterState>) => onChange({ ...filters, ...partial });

  const reset = () =>
    onChange({
      studios: [],
      programSearch: '',
      instructors: [],
      ticketFilter: 'ALL',
      bookmarkOnly: false,
    });

  // フィルタ件数（ブックマーク除外）
  const activeCount =
    (filters.studios.length > 0 ? 1 : 0) +
    (filters.programSearch ? 1 : 0) +
    (filters.instructors.length > 0 ? 1 : 0) +
    (filters.ticketFilter !== 'ALL' ? 1 : 0);

  const hasActiveFilters = activeCount > 0;

  return (
    <div className="space-y-2">
      {/* ── 常時表示ヘッダー ── */}
      {!hideToolbar && (
        <div className="flex items-center gap-2">
          {/* ブックマーク */}
          <Button
            variant={filters.bookmarkOnly ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-8 text-xs gap-1.5 px-3',
              filters.bookmarkOnly && 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500'
            )}
            onClick={() => update({ bookmarkOnly: !filters.bookmarkOnly })}
          >
            <Star className={cn('h-3.5 w-3.5', filters.bookmarkOnly && 'fill-white')} />
            ブックマーク
          </Button>

          <div className="flex-1" />

          {/* フィルタ展開トグル */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 px-3"
            onClick={() => setOpen(!open)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            絞り込み
            {activeCount > 0 && (
              <Badge variant="secondary" className="rounded-full px-1.5 h-5 text-[10px] ml-0.5">
                {activeCount}
              </Badge>
            )}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </Button>

          {/* リセット */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 px-2 text-muted-foreground" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* ── 選択チップ（常時表示） ── */}
      {(filters.studios.length > 0 || filters.instructors.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.studios.map((s) => (
            <Badge key={`s-${s}`} variant="outline" className="gap-1 pr-1 text-xs h-6">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              {s}
              <button
                onClick={() => update({ studios: filters.studios.filter((x) => x !== s) })}
                className="rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {filters.studios.length > 0 && filters.instructors.length > 0 && (
            <span className="text-muted-foreground/40 text-xs">|</span>
          )}
          {filters.instructors.map((ir) => (
            <Badge key={`ir-${ir}`} variant="outline" className="gap-1 pr-1 text-xs h-6 border-blue-200 text-blue-700">
              <User className="h-3 w-3" />
              {ir}
              <button
                onClick={() => update({ instructors: filters.instructors.filter((x) => x !== ir) })}
                className="rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* ── 折り畳みフィルタ本体 ── */}
      <div className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      )}>
        <div className="overflow-hidden">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm divide-y">
            {/* セクション1: スタジオ・インストラクター */}
            <div className="p-3 space-y-2">
              <SectionLabel>スタジオ・インストラクター</SectionLabel>
              <div className="flex flex-col sm:flex-row gap-2">
                <StudioMultiSelect
                  selected={filters.studios}
                  onChange={(studios) => update({ studios })}
                />
                <InstructorMultiSelect
                  instructors={allInstructors}
                  selected={filters.instructors}
                  onChange={(instructors) => update({ instructors })}
                />
              </div>
            </div>

            {/* セクション2: プログラム検索 */}
            <div className="p-3 space-y-2">
              <SectionLabel>プログラム</SectionLabel>
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={filters.programSearch}
                  onChange={(e) => update({ programSearch: e.target.value })}
                  placeholder="プログラム名で検索"
                  className="h-9 pl-8 text-sm"
                />
              </div>
            </div>

            {/* セクション3: チケット */}
            <div className="p-3 space-y-2">
              <SectionLabel>チケット種類</SectionLabel>
              <ToggleGroup
                type="single"
                value={filters.ticketFilter}
                onValueChange={(v) => {
                  if (v) update({ ticketFilter: v as FilterState['ticketFilter'] });
                }}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="ALL" className="text-xs h-7 px-3 data-[state=on]:bg-foreground data-[state=on]:text-background">全て</ToggleGroupItem>
                <ToggleGroupItem value="NORMAL" className="text-xs h-7 px-3 data-[state=on]:bg-foreground data-[state=on]:text-background">通常</ToggleGroupItem>
                <ToggleGroupItem value="ADDITIONAL" className="text-xs h-7 px-3 data-[state=on]:bg-foreground data-[state=on]:text-background">ADD</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* セクション4: お気に入り条件 */}
            <div className="p-3 space-y-2">
              <SectionLabel>お気に入り条件</SectionLabel>
              <PresetManager
                presets={presets}
                onLoad={onLoadPreset}
                onSave={onSavePreset}
                onUpdate={onUpdatePreset}
                onDelete={onDeletePreset}
                onSetDefault={onSetDefaultPreset}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
