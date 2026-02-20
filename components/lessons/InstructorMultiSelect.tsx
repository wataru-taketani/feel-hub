'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

interface InstructorMultiSelectProps {
  instructors: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: string;
  labelUnit?: string;
  searchPlaceholder?: string;
}

export default function InstructorMultiSelect({ instructors, selected, onChange, label = 'IR選択', labelUnit = '名', searchPlaceholder = 'IR名で検索...' }: InstructorMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (ir: string) => {
    if (selected.includes(ir)) {
      onChange(selected.filter((s) => s !== ir));
    } else {
      onChange([...selected, ir]);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-9 gap-1 min-w-[110px] justify-between" onClick={() => setOpen(true)}>
        {selected.length === 0 ? (
          <span className="text-muted-foreground">{label}</span>
        ) : (
          <Badge variant="secondary" className="rounded-sm px-1 h-5 text-[10px]">
            {selected.length}{labelUnit}
          </Badge>
        )}
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xs p-0 gap-0">
          <DialogTitle className="sr-only">{label}</DialogTitle>
          <Command
            filter={(value, search) =>
              value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandInput placeholder={searchPlaceholder} />

            {selected.length > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
                <span className="text-xs text-muted-foreground">{selected.length}{labelUnit}選択中</span>
                <Button variant="ghost" size="sm" className="h-auto py-0.5 px-1.5 text-xs" onClick={() => onChange([])}>
                  <X className="h-3 w-3 mr-1" />クリア
                </Button>
              </div>
            )}

            <CommandList className="max-h-[50vh]">
              <CommandEmpty>該当なし</CommandEmpty>
              <CommandGroup>
                {instructors.map((ir) => (
                  <CommandItem key={ir} value={ir} onSelect={() => toggle(ir)}>
                    <Check className={cn('mr-2 h-4 w-4', selected.includes(ir) ? 'opacity-100' : 'opacity-0')} />
                    {ir}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
