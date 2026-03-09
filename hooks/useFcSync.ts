import { useState, useCallback, useRef } from 'react';

const FC_SYNC_TTL_MS = 10 * 60 * 1000; // 10分

interface UseFcSyncOptions {
  /** 同期完了後にデータを再取得するコールバック */
  onSynced?: () => void;
}

interface UseFcSyncReturn {
  /** 同期中かどうか */
  syncing: boolean;
  /** fc_synced_at を受け取り、必要なら同期を開始する */
  checkAndSync: (fcSyncedAt: string | null) => void;
}

/**
 * FCデータの同期状態を管理するフック。
 * fc_synced_at が10分以上前（またはnull）なら /api/fc-sync をバックグラウンドで呼び出す。
 */
export function useFcSync({ onSynced }: UseFcSyncOptions = {}): UseFcSyncReturn {
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const checkAndSync = useCallback((fcSyncedAt: string | null) => {
    // 既に同期中なら何もしない
    if (syncingRef.current) return;

    // 同期が不要か判定
    if (fcSyncedAt) {
      const elapsed = Date.now() - new Date(fcSyncedAt).getTime();
      if (elapsed < FC_SYNC_TTL_MS) return;
    }

    // バックグラウンドで同期開始
    syncingRef.current = true;
    setSyncing(true);

    fetch('/api/fc-sync', { method: 'POST' })
      .then(res => {
        if (res.ok) {
          onSynced?.();
        }
      })
      .catch(e => {
        console.warn('FC sync failed:', e);
      })
      .finally(() => {
        syncingRef.current = false;
        setSyncing(false);
      });
  }, [onSynced]);

  return { syncing, checkAndSync };
}
