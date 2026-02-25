/**
 * 自動予約ロジック（Step 1: S-1ケースのみ）
 *
 * 空き検知時に FC にログインし、空席を選んで予約を実行する。
 * result_code に応じて LINE 通知を送信。
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { decrypt, login, getSeatMap, reserveLesson, reserveCompletion } from './fcClient';

interface AutoReserveEntry {
  id: string;
  user_id: string;
  lesson_id: string;
  lessons: {
    sid_hash: string;
    program_name: string;
    date: string;
    time: string;
    end_time: string;
    instructor: string;
    studio: string;
  };
}

/** 自動予約の結果 */
export type AutoReserveResult =
  | 'success'        // rc=0: 予約成功
  | 'needs_confirm'  // rc=303: 手動確認が必要
  | 'conflict'       // rc=205: 競合（次サイクルで再試行）
  | 'error'          // その他エラー
  | 'auth_failed'    // FC認証失敗（初回：auth_valid=false にセット + LINE通知）
  | 'auth_invalid';  // 認証無効済み（既にflag済みなのでスキップ）

export async function autoReserveLesson(
  entry: AutoReserveEntry,
  supabase: SupabaseClient,
  lineUserId: string | null
): Promise<AutoReserveResult> {
  const tag = `[AutoReserve entry=${entry.id}]`;
  const sidHash = entry.lessons.sid_hash;

  if (!sidHash) {
    console.error(`${tag} sid_hash is missing, skipping`);
    await notify(lineUserId, formatErrorMessage(entry, 'レッスン情報が不足しています'));
    return 'error';
  }

  // 1. FC認証情報を取得して復号
  const { data: cred } = await supabase
    .from('feelcycle_credentials')
    .select('email_encrypted, password_encrypted, auth_valid')
    .eq('user_id', entry.user_id)
    .single();

  if (!cred) {
    console.error(`${tag} No FC credentials for user ${entry.user_id}`);
    await notify(lineUserId, '【自動予約失敗】\nFEELCYCLE連携が未設定です。マイページから再設定してください。');
    return 'auth_failed';
  }

  // 認証無効フラグチェック（パスワード変更等で以前失敗済み → ログイン試行しない）
  if (cred.auth_valid === false) {
    console.log(`${tag} Credentials flagged as invalid, skipping login`);
    return 'auth_invalid';
  }

  let email: string;
  let password: string;
  try {
    email = decrypt(cred.email_encrypted);
    password = decrypt(cred.password_encrypted);
  } catch (e) {
    console.error(`${tag} Failed to decrypt credentials:`, e);
    await notify(lineUserId, '【自動予約失敗】\nFEELCYCLE認証情報の復号に失敗しました。マイページから再設定してください。');
    return 'auth_failed';
  }

  // 2. FCログイン
  let session;
  try {
    session = await login(email, password);
    console.log(`${tag} FC login successful`);
  } catch (e) {
    console.error(`${tag} FC login failed:`, e);
    // 認証無効フラグをセット → 以降のログイン試行を停止（アカウントロック防止）
    await supabase
      .from('feelcycle_credentials')
      .update({ auth_valid: false })
      .eq('user_id', entry.user_id);
    console.log(`${tag} Marked credentials as invalid for user ${entry.user_id}`);
    await notify(lineUserId, '【自動予約停止】\nFEELCYCLEへのログインに失敗しました。\nパスワードが変更された可能性があります。\n\nマイページからFC連携を再設定してください。\nhttps://feel-hub.vercel.app/mypage');
    return 'auth_failed';
  }

  // 3. 座席マップ取得 → 空席選択
  let sheetNo: string;
  try {
    const bikes = await getSeatMap(session, sidHash);
    const availableSeats = Object.entries(bikes)
      .filter(([, b]) => b.status === 1)
      .map(([no]) => no);

    if (availableSeats.length === 0) {
      console.log(`${tag} No available seats found (race condition), will retry next cycle`);
      return 'conflict';
    }

    // 最初の空席を選択（番号順で最小）
    availableSeats.sort((a, b) => Number(a) - Number(b));
    sheetNo = availableSeats[0];
    console.log(`${tag} Selected seat #${sheetNo} from ${availableSeats.length} available`);
  } catch (e) {
    console.error(`${tag} getSeatMap failed:`, e);
    if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
      await notify(lineUserId, '【自動予約失敗】\nFEELCYCLEセッションが切れました。マイページから再設定してください。');
      return 'auth_failed';
    }
    return 'error';
  }

  // 4. 予約実行
  try {
    const result = await reserveLesson(session, sidHash, sheetNo);
    console.log(`${tag} Reserve result: rc=${result.resultCode}, msg=${result.message}`, JSON.stringify(result.raw));

    switch (result.resultCode) {
      case 0: {
        // 成功
        const msg = formatSuccessMessage(entry, sheetNo);
        await notify(lineUserId, msg);
        return 'success';
      }
      case 303: {
        // modal_type に応じて自動完了 or 手動案内
        const modalType = Number(result.raw.modal_type ?? 0);
        const tmpLessonId = result.raw.tmp_lesson_id as string | undefined;
        console.log(`${tag} rc=303 modal_type=${modalType} tmp_lesson_id=${tmpLessonId}`);

        // 自動完了可能なケース
        if (tmpLessonId && (modalType === 1042 || modalType === 1143)) {
          // 1042: 他店利用案内 → 自動でOK
          // 1143: チケット消費確認 → 自動で確定
          let ticketType: number | undefined;
          if (modalType === 1143) {
            // consumption_ticket_list から最初のチケットを選択
            const tickets = result.raw.consumption_ticket_list as Array<{ ticket_type?: number }> | undefined;
            ticketType = tickets?.[0]?.ticket_type;
          }

          const completion = await reserveCompletion(session, tmpLessonId, ticketType);
          console.log(`${tag} Completion result: rc=${completion.resultCode}, msg=${completion.message}`, JSON.stringify(completion.raw));

          if (completion.resultCode === 0) {
            const extra = modalType === 1143 ? '\n(チケット1枚使用)' : modalType === 1042 ? '\n(他店利用)' : '';
            await notify(lineUserId, formatSuccessMessage(entry, sheetNo) + extra);
            return 'success';
          }
          // completion 失敗
          console.error(`${tag} Completion failed: rc=${completion.resultCode}`);
          await notify(lineUserId, formatErrorMessage(entry, completion.message || `確定エラー (rc=${completion.resultCode})`));
          return 'error';
        }

        // 自動完了不可: 差替え提案(1024), チケット購入誘導(10242), 未知の modal_type
        const reason = modalType === 1024
          ? '既存予約との差替えが提案されました。手動で確認してください。'
          : modalType === 10242
          ? result.raw.message as string || 'イベントチケットが必要です。'
          : result.message || `追加操作が必要です (modal_type=${modalType})`;
        await notify(lineUserId, formatNeedsConfirmMessage(entry, reason));
        return 'needs_confirm';
      }
      case 205: {
        // 競合（他の人が先に取った）
        console.log(`${tag} Seat conflict (rc=205), will retry next cycle`);
        return 'conflict';
      }
      default: {
        // その他エラー
        console.error(`${tag} Unexpected result_code=${result.resultCode}: ${result.message}`);
        await notify(lineUserId, formatErrorMessage(entry, result.message || `エラーコード: ${result.resultCode}`));
        return 'error';
      }
    }
  } catch (e) {
    console.error(`${tag} reserveLesson threw:`, e);
    if (e instanceof Error && e.message === 'SESSION_EXPIRED') {
      await notify(lineUserId, '【自動予約失敗】\nFEELCYCLEセッションが切れました。マイページから再設定してください。');
      return 'auth_failed';
    }
    return 'error';
  }
}

// ── メッセージテンプレート ──

function formatLessonInfo(entry: AutoReserveEntry): string {
  const l = entry.lessons;
  const d = new Date(l.date);
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}(${days[d.getDay()]})`;
  const startTime = l.time.slice(0, 5);
  const endTime = l.end_time.slice(0, 5);
  return `${l.program_name}\n${dateStr} ${startTime}〜${endTime}\n${l.instructor}\n${l.studio}`;
}

function formatSuccessMessage(entry: AutoReserveEntry, sheetNo: string): string {
  return `【自動予約完了】\n${formatLessonInfo(entry)}\nバイク: ${sheetNo}\n\nhttps://m.feelcycle.com/mypage`;
}

function formatNeedsConfirmMessage(entry: AutoReserveEntry, reason?: string): string {
  const detail = reason || '追加確認が必要です。手動で予約してください。';
  return `【要確認】空きが出ました\n${formatLessonInfo(entry)}\n\n${detail}\nhttps://m.feelcycle.com/mypage`;
}

function formatErrorMessage(entry: AutoReserveEntry, detail: string): string {
  return `【自動予約失敗】\n${formatLessonInfo(entry)}\n\n${detail}`;
}

// ── LINE通知 ──

async function notify(lineUserId: string | null, message: string): Promise<void> {
  if (!lineUserId) {
    console.warn('No LINE user ID, skipping notification');
    return;
  }
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.error('LINE_CHANNEL_ACCESS_TOKEN is not set');
    return;
  }
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: 'text', text: message }],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`LINE push failed: ${res.status} ${body}`);
    }
  } catch (e) {
    console.error('LINE notification error:', e);
  }
}
