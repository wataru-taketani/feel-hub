'use client';

import { useState } from 'react';
import { MapPin, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { STUDIO_REGIONS, formatStudio } from '@/lib/lessonUtils';

interface StudioMultiSelectProps {
  selected: string[];
  onChange: (studios: string[]) => void;
}

export default function StudioMultiSelect({ selected, onChange }: StudioMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleStudio = (studio: string) => {
    if (selected.includes(studio)) {
      onChange(selected.filter((s) => s !== studio));
    } else {
      onChange([...selected, studio]);
    }
  };

  const togglePrefecture = (studios: string[]) => {
    const allSelected = studios.every((s) => selected.includes(s));
    if (allSelected) {
      onChange(selected.filter((s) => !studios.includes(s)));
    } else {
      const newSet = new Set([...selected, ...studios]);
      onChange([...newSet]);
    }
  };

  const label = selected.length === 0
    ? 'スタジオ選択'
    : selected.length === 1
      ? selected[0]
      : `${selected.length}店舗`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 min-w-[130px] justify-between">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{label}</span>
          {selected.length > 1 && (
            <Badge variant="secondary" className="rounded-sm px-1 h-5 text-[10px] shrink-0">
              {selected.length}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0 max-h-[420px] overflow-y-auto" align="start">
        {/* ヘッダー */}
        <div className="sticky top-0 z-10 bg-popover border-b px-3 py-2 flex items-center justify-between">
          <span className="text-sm font-semibold">店舗選択</span>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" className="h-auto py-0.5 px-1.5 text-xs" onClick={() => onChange([])}>
              <X className="h-3 w-3 mr-1" />選択解除
            </Button>
          )}
        </div>

        {/* エリア別リスト */}
        {STUDIO_REGIONS.map((region) => (
          <div key={region.area}>
            <div className="px-3 py-1.5 bg-muted/50 text-[11px] font-semibold text-muted-foreground tracking-wide">
              {region.area}
            </div>
            {region.prefectures.map((pref) => {
              const prefKey = `${region.area}_${pref.name}`;
              const isExpanded = expanded[prefKey] ?? false;
              const allChecked = pref.studios.every((s) => selected.includes(s));
              const someChecked = pref.studios.some((s) => selected.includes(s));

              return (
                <div key={prefKey}>
                  {/* 県ヘッダー */}
                  <div
                    className="flex items-center px-3 py-1.5 hover:bg-accent/50 cursor-pointer border-b border-border/50"
                    onClick={() => toggleExpand(prefKey)}
                  >
                    <Checkbox
                      checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                      onCheckedChange={() => togglePrefecture(pref.studios)}
                      onClick={(e) => e.stopPropagation()}
                      className="mr-2"
                    />
                    <span className="text-sm flex-1">
                      {pref.name}({pref.studios.length})
                    </span>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                  </div>

                  {/* スタジオリスト */}
                  {isExpanded && (
                    <div className="bg-muted/20">
                      {pref.studios.map((studio) => (
                        <label
                          key={studio}
                          className="flex items-center px-6 py-1.5 hover:bg-accent/50 cursor-pointer border-b border-border/30 text-sm"
                        >
                          <Checkbox
                            checked={selected.includes(studio)}
                            onCheckedChange={() => toggleStudio(studio)}
                            className="mr-2"
                          />
                          {formatStudio(studio)}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
