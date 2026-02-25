'use client';

import { useState } from 'react';
import { MapPin, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { STUDIO_REGIONS, formatStudio } from '@/lib/lessonUtils';

interface StudioMultiSelectProps {
  selected: string[];
  onChange: (studios: string[]) => void;
}

export default function StudioMultiSelect({ selected, onChange }: StudioMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // ダイアログ内の一時選択状態（閉じたときだけ親に反映）
  const [draft, setDraft] = useState<string[]>(selected);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setDraft(selected);
    } else {
      // 閉じるときに変更があれば反映
      const draftKey = [...draft].sort().join(',');
      const selectedKey = [...selected].sort().join(',');
      if (draftKey !== selectedKey) {
        onChange(draft);
      }
    }
    setOpen(isOpen);
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleStudio = (studio: string) => {
    if (draft.includes(studio)) {
      setDraft(draft.filter((s) => s !== studio));
    } else {
      setDraft([...draft, studio]);
    }
  };

  const togglePrefecture = (studios: string[]) => {
    const allSelected = studios.every((s) => draft.includes(s));
    if (allSelected) {
      setDraft(draft.filter((s) => !studios.includes(s)));
    } else {
      const newSet = new Set([...draft, ...studios]);
      setDraft([...newSet]);
    }
  };

  const label = selected.length === 0
    ? 'スタジオ選択'
    : selected.length === 1
      ? selected[0]
      : `${selected.length}店舗`;

  return (
    <>
      <Button variant="outline" size="sm" className="h-9 gap-1.5 min-w-[130px] justify-between" onClick={() => handleOpen(true)}>
        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate">{label}</span>
        {selected.length > 1 && (
          <Badge variant="secondary" className="rounded-sm px-1 h-5 text-[10px] shrink-0">
            {selected.length}
          </Badge>
        )}
        <ChevronDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-xs p-0 gap-0 max-h-[80vh] flex flex-col [&>button.absolute]:hidden">
          <DialogTitle className="sr-only">店舗選択</DialogTitle>
          {/* ヘッダー */}
          <div className="border-b px-3 py-2 flex items-center justify-between shrink-0">
            <span className="text-sm font-semibold">店舗選択</span>
            <div className="flex items-center gap-2">
              {draft.length > 0 && (
                <Button variant="ghost" size="sm" className="h-auto py-0.5 px-1.5 text-xs" onClick={() => setDraft([])}>
                  選択解除
                </Button>
              )}
              <button onClick={() => handleOpen(false)} className="rounded-sm opacity-70 active:opacity-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* エリア別リスト */}
          <div className="overflow-y-auto">
            {STUDIO_REGIONS.map((region) => (
              <div key={region.area}>
                <div className="px-3 py-1.5 bg-muted/50 text-[11px] font-semibold text-muted-foreground tracking-wide">
                  {region.area}
                </div>
                {region.prefectures.map((pref) => {
                  const prefKey = `${region.area}_${pref.name}`;
                  const isExpanded = expanded[prefKey] ?? false;
                  const allChecked = pref.studios.every((s) => draft.includes(s));
                  const someChecked = pref.studios.some((s) => draft.includes(s));

                  return (
                    <div key={prefKey}>
                      {/* 県ヘッダー */}
                      <div
                        className="flex items-center px-3 py-1.5 active:bg-accent/50 cursor-pointer border-b border-border/50"
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
                              className="flex items-center px-6 py-1.5 active:bg-accent/50 cursor-pointer border-b border-border/30 text-sm"
                            >
                              <Checkbox
                                checked={draft.includes(studio)}
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
