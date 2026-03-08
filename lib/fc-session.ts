/**
 * FEELCYCLE セッション取得ヘルパー
 *
 * DB保存済みセッションを取得し、FC API側で期限切れの場合は
 * 保存済み認証情報で自動再ログインして新セッションを返す。
 *
 * 呼び出し元APIは SESSION_EXPIRED を意識する必要がなくなる。
 */

import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from '@/lib/crypto';
import { login as fcLogin } from '@/lib/feelcycle-api';
import type { FeelcycleSession } from '@/lib/feelcycle-api';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type FcSessionResult =
  | { ok: true; session: FeelcycleSession }
  | { ok: false; code: 'FC_NOT_LINKED' | 'FC_SESSION_EXPIRED' | 'DECRYPT_FAILED'; error: string };

/**
 * 有効な FC セッションを取得する。
 * 期限切れの場合は自動的に再認証を試みる。
 */
export async function getFcSession(userId: string): Promise<FcSessionResult> {
  const { data: sessionRow } = await supabaseAdmin
    .from('feelcycle_sessions')
    .select('session_encrypted, expires_at')
    .eq('user_id', userId)
    .single();

  // セッション行があり、DB上の有効期限内なら復号して返す
  if (sessionRow && new Date(sessionRow.expires_at) >= new Date()) {
    try {
      const session: FeelcycleSession = JSON.parse(decrypt(sessionRow.session_encrypted));
      return { ok: true, session };
    } catch {
      // 復号失敗 → 再認証にフォールスルー
    }
  }

  // セッションなし or DB上の期限切れ or 復号失敗 → 自動再認証
  return reauthSession(userId);
}

/**
 * FC APIが SESSION_EXPIRED を返した場合に呼ぶ。
 * 保存済み認証情報で再ログインし、新セッションをDBに保存して返す。
 */
export async function reauthSession(userId: string): Promise<FcSessionResult> {
  const { data: creds } = await supabaseAdmin
    .from('feelcycle_credentials')
    .select('email_encrypted, password_encrypted')
    .eq('user_id', userId)
    .single();

  if (!creds) {
    return { ok: false, code: 'FC_NOT_LINKED', error: 'FEELCYCLE未連携' };
  }

  let email: string, password: string;
  try {
    email = decrypt(creds.email_encrypted);
    password = decrypt(creds.password_encrypted);
  } catch {
    return { ok: false, code: 'DECRYPT_FAILED', error: 'FEELCYCLE連携情報が破損しています' };
  }

  let newSession: FeelcycleSession;
  try {
    newSession = await fcLogin(email, password) as FeelcycleSession;
  } catch {
    return { ok: false, code: 'FC_SESSION_EXPIRED', error: 'FEELCYCLEへの再接続に失敗しました' };
  }

  // 新セッションをDBに保存
  await supabaseAdmin
    .from('feelcycle_sessions')
    .upsert({
      user_id: userId,
      session_encrypted: encrypt(JSON.stringify(newSession)),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });

  return { ok: true, session: newSession };
}
