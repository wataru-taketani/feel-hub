'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Loader2, CheckCircle } from 'lucide-react';

function InviteContent() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    groupId: string;
    groupName: string;
    memberCount: number;
    creatorName: string;
    alreadyJoined: boolean;
  } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await fetch(`/api/groups/invite/${code}`);
        if (res.status === 401) {
          setIsLoggedIn(false);
          setLoading(false);
          return;
        }
        setIsLoggedIn(true);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || '招待リンクが無効です');
          return;
        }
        const data = await res.json();
        setPreview(data);
      } catch {
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [code]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await fetch(`/api/groups/invite/${code}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '参加に失敗しました');
        return;
      }
      router.push(`/groups/${data.groupId}`);
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // 未ログイン
  if (isLoggedIn === false) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Users className="h-12 w-12 mx-auto text-primary mb-2" />
            <CardTitle>グループに招待されています</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              asChild
              className="w-full bg-[#06C755] active:bg-[#05b04c] text-white text-base py-6"
            >
              <a href={`/api/auth/line?redirect_to=/groups/invite/${code}`}>
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                LINEでログインして参加
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // エラー
  if (error) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!preview) return null;

  // 参加済み
  if (preview.alreadyJoined) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
            <CardTitle>すでに参加しています</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => router.push(`/groups/${preview.groupId}`)}
            >
              グループを見る
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 未参加 → 参加画面
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Users className="h-12 w-12 mx-auto text-primary mb-2" />
          <CardTitle>{preview.groupName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p>作成者: {preview.creatorName}</p>
            <p>メンバー: {preview.memberCount}人</p>
          </div>
          <Button className="w-full" onClick={handleJoin} disabled={joining}>
            {joining ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            参加する
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    }>
      <InviteContent />
    </Suspense>
  );
}
