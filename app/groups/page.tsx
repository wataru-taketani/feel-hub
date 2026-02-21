'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, Users, Crown, Loader2 } from 'lucide-react';
import type { Group } from '@/types';

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/groups');
      const data = await res.json();
      setGroups(data.groups || []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreate = async () => {
    const name = newGroupName.trim();
    if (!name) return;

    setCreating(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (!res.ok) {
        setCreateError(data.error || '作成に失敗しました');
        return;
      }

      setShowCreateDialog(false);
      setNewGroupName('');
      router.push(`/groups/${data.group.id}`);
    } catch {
      setCreateError('通信エラーが発生しました');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">グループ</h1>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          作成
        </Button>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">グループを作成して仲間を招待しましょう</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="active:bg-accent/50 transition-colors cursor-pointer"
              onClick={() => router.push(`/groups/${group.id}`)}
            >
              <CardContent className="py-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{group.name}</p>
                    {group.isCreator && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        <Crown className="h-3 w-3 mr-0.5" />
                        作成者
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span className="text-sm">{group.memberCount}人</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>グループを作成</DialogTitle>
            <DialogDescription>グループ名を入力してください（50文字以内）</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {createError && (
              <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
                {createError}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="group-name">グループ名</Label>
              <Input
                id="group-name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                maxLength={50}
                placeholder="例: FEEL仲間"
                disabled={creating}
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCreateDialog(false)}
              disabled={creating}
            >
              キャンセル
            </Button>
            <Button
              className="flex-1"
              onClick={handleCreate}
              disabled={creating || !newGroupName.trim()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              作成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
