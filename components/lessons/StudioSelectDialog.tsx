'use client';

import { useState } from 'react';
import { MapPin, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { STUDIO_REGIONS, formatStudio } from '@/lib/lessonUtils';

interface StudioSelectDialogProps {
  open: boolean;
  onSelect: (studio: string | null) => void;
}

export default function StudioSelectDialog({ open, onSelect }: StudioSelectDialogProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            スタジオを選択
          </DialogTitle>
          <DialogDescription>
            よく利用するスタジオを選んでください
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto -mx-2">
          {STUDIO_REGIONS.map((region) => (
            <div key={region.area}>
              <div className="px-3 py-1.5 bg-muted/50 text-[11px] font-semibold text-muted-foreground tracking-wide">
                {region.area}
              </div>
              {region.prefectures.map((pref) => {
                const prefKey = `${region.area}_${pref.name}`;
                const isExpanded = expanded[prefKey] ?? false;

                return (
                  <div key={prefKey}>
                    <div
                      className="flex items-center px-3 py-2 active:bg-accent/30 cursor-pointer border-b border-border/50"
                      onClick={() => toggleExpand(prefKey)}
                    >
                      <span className="text-sm flex-1">
                        {pref.name}({pref.studios.length})
                      </span>
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-180')} />
                    </div>

                    {isExpanded && (
                      <div className="bg-muted/20">
                        {pref.studios.map((studio) => (
                          <div
                            key={studio}
                            className="px-6 py-2 active:bg-accent/30 cursor-pointer border-b border-border/30 text-sm"
                            onClick={() => onSelect(studio)}
                          >
                            {formatStudio(studio)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => onSelect(null)}
        >
          全店舗を表示
        </Button>
      </DialogContent>
    </Dialog>
  );
}
