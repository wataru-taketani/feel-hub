'use client';

import { useState } from 'react';
import { Plus, MoreVertical, Star, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FilterPreset } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PresetManagerProps {
  presets: FilterPreset[];
  onLoad: (preset: FilterPreset) => void;
  onSave: (name: string) => void;
  onUpdate: (id: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string | null) => void;
}

export default function PresetManager({ presets, onLoad, onSave, onUpdate, onDelete, onSetDefault }: PresetManagerProps) {
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
        <div key={p.id} className="flex items-center">
          <Badge
            variant="secondary"
            className={cn(
              'cursor-pointer hover:bg-accent gap-1 pr-0.5 transition-colors',
              p.isDefault && 'ring-1 ring-yellow-400'
            )}
            onClick={() => onLoad(p)}
          >
            {p.isDefault && <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />}
            {p.name}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                >
                  <MoreVertical className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                <DropdownMenuItem onClick={() => onUpdate(p.id)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  現在の条件で上書き
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetDefault(p.isDefault ? null : p.id)}>
                  <Star className="h-3.5 w-3.5 mr-2" />
                  {p.isDefault ? 'デフォルト解除' : 'デフォルトに設定'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(p.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  削除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Badge>
        </div>
      ))}

      {showInput ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="お気に入り名"
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
