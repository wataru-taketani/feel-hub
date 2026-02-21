'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Copy, Crown, Link2, Loader2, LogOut, RefreshCw, Trash2, Users, Check } from 'lucide-react';
import type { Group, GroupMember } from '@/types';

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchGroup = useCallback(async () => {
    try {
      const res = await fetch(`/api/groups/${id}`);
      if (!res.ok) {
        setError('グループが見つかりません');
        return;
      }
      const data = await res.json();
      setGroup(data.group);
      setMembers(data.members);
    } catch {
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const inviteUrl = group
    ? `${window.location.origin}/groups/invite/${group.inviteCode}`
    : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/groups');
      }
    } catch {
      // error
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/groups/${id}/leave`, { method: 'POST' });
      if (res.ok) {
        router.push('/groups');
      }
    } catch {
      // error
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/groups/${id}/regenerate-invite`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && group) {
        setGroup({ ...group, inviteCode: data.inviteCode });
        setShowRegenerateDialog(false);
      }
    } catch {
      // error
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p>{error || 'グループが見つかりません'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">{group.name}</h1>

      {/* 招待URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4" />
            招待リンク
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm truncate">
              {inviteUrl}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            このリンクを共有してメンバーを招待できます
          </p>
        </CardContent>
      </Card>

      {/* メンバー一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            メンバー（{members.length}人）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {members.map((member, i) => (
            <div key={member.userId}>
              {i > 0 && <Separator className="my-2" />}
              <div className="flex items-center gap-3">
                {member.linePictureUrl ? (
                  <img
                    src={member.linePictureUrl}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {member.displayName || '名前未設定'}
                    </span>
                    {member.role === 'creator' && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        <Crown className="h-3 w-3 mr-0.5" />
                        作成者
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* アクション */}
      <div className="space-y-2">
        {group.isCreator ? (
          <>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowRegenerateDialog(true)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              招待コードを再生成
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              グループを削除
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            className="w-full justify-start text-destructive"
            onClick={() => setShowLeaveDialog(true)}
          >
            <LogOut className="h-4 w-4 mr-2" />
            グループを退出
          </Button>
        )}
      </div>

      {/* 削除確認ダイアログ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>グループを削除</DialogTitle>
            <DialogDescription>
              「{group.name}」を削除しますか？この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeleteDialog(false)} disabled={actionLoading}>
              キャンセル
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 退出確認ダイアログ */}
      <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>グループを退出</DialogTitle>
            <DialogDescription>
              「{group.name}」を退出しますか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowLeaveDialog(false)} disabled={actionLoading}>
              キャンセル
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleLeave} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              退出
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 招待コード再生成確認ダイアログ */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>招待コードを再生成</DialogTitle>
            <DialogDescription>
              現在の招待リンクは無効になります。よろしいですか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowRegenerateDialog(false)} disabled={actionLoading}>
              キャンセル
            </Button>
            <Button className="flex-1" onClick={handleRegenerate} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              再生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
