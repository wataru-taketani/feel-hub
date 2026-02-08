'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

interface InstructorMultiSelectProps {
  instructors: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function InstructorMultiSelect({ instructors, selected, onChange }: InstructorMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (ir: string) => {
    if (selected.includes(ir)) {
      onChange(selected.filter((s) => s !== ir));
    } else {
      onChange([...selected, ir]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1 min-w-[110px] justify-between">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">IR選択</span>
          ) : (
            <span className="flex items-center gap-1">
              <Badge variant="secondary" className="rounded-sm px-1 h-5 text-[10px]">
                {selected.length}名
              </Badge>
            </span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="IR名で検索..." />

          {selected.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
              <span className="text-xs text-muted-foreground">{selected.length}名選択中</span>
              <Button variant="ghost" size="sm" className="h-auto py-0.5 px-1.5 text-xs" onClick={() => onChange([])}>
                <X className="h-3 w-3 mr-1" />クリア
              </Button>
            </div>
          )}

          <CommandList>
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
      </PopoverContent>
    </Popover>
  );
}
