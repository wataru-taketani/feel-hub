'use client';

import { useState } from 'react';
import { Plus, X, RefreshCw } from 'lucide-react';
import type { FilterPreset } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PresetManagerProps {
  presets: FilterPreset[];
  onLoad: (preset: FilterPreset) => void;
  onSave: (name: string) => void;
  onUpdate: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function PresetManager({ presets, onLoad, onSave, onUpdate, onDelete }: PresetManagerProps) {
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName('');
    setShowInput(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map((p) => (
        <Badge
          key={p.id}
          variant="secondary"
          className="cursor-pointer hover:bg-accent gap-0.5 pr-0.5 transition-colors"
          onClick={() => onLoad(p)}
        >
          {p.name}
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate(p.id);
                  }}
                  className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                現在のフィルタで上書き
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(p.id);
            }}
            className="rounded-full hover:bg-destructive/20 hover:text-destructive p-0.5 transition-colors"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </Badge>
      ))}

      {showInput ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="プリセット名"
            className="h-7 w-28 text-xs"
            autoFocus
          />
          <Button size="sm" className="h-7 text-xs px-2" onClick={handleSave}>
            保存
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setShowInput(false)}>
            取消
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs px-2 rounded-full border-dashed"
          onClick={() => setShowInput(true)}
        >
          <Plus className="h-3 w-3 mr-0.5" />
          保存
        </Button>
      )}
    </div>
  );
}
