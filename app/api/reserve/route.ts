import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { reserveLesson, reserveCompletion } from '@/lib/feelcycle-api';
import type { FeelcycleSession } from '@/lib/feelcycle-api';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '未認証' }, { status: 401 });
  }

  const { sidHash, sheetNo } = await request.json();

  if (!sidHash || !sheetNo) {
    return NextResponse.json({ error: 'sidHash and sheetNo are required' }, { status: 400 });
  }

  // FEELCYCLEセッション取得・復号
  const { data: sessionRow } = await supabaseAdmin
    .from('feelcycle_sessions')
    .select('session_encrypted, expires_at')
    .eq('user_id', user.id)
    .single();

  if (!sessionRow) {
    return NextResponse.json({ error: 'FEELCYCLE未連携', code: 'FC_NOT_LINKED' }, { status: 404 });
  }

  if (new Date(sessionRow.expires_at) < new Date()) {
    return NextResponse.json({ error: 'セッションが期限切れです', code: 'FC_SESSION_EXPIRED' }, { status: 401 });
  }

  let fcSession: FeelcycleSession;
  try {
    fcSession = JSON.parse(decrypt(sessionRow.session_encrypted));
  } catch {
    return NextResponse.json({ error: 'セッションの復号に失敗しました' }, { status: 500 });
  }

  try {
    const result = await reserveLesson(fcSession, sidHash, String(sheetNo));

    switch (result.resultCode) {
      case 0:
        // 成功
        return NextResponse.json({
          success: true,
          resultCode: 0,
          message: '予約が完了しました',
          sheetNo: String(sheetNo),
        });

      case 303: {
        // modal_type に応じて自動完了 or 手動確認必要
        const modalType = Number(result.raw.modal_type ?? 0);
        const tmpLessonId = result.raw.tmp_lesson_id as string | undefined;

        // 自動完了可能なケース
        if (tmpLessonId && (modalType === 1042 || modalType === 1143)) {
          let ticketType: number | undefined;
          if (modalType === 1143) {
            const tickets = result.raw.consumption_ticket_list as Array<{ ticket_type?: number }> | undefined;
            ticketType = tickets?.[0]?.ticket_type;
          }

          const completion = await reserveCompletion(fcSession, tmpLessonId, ticketType);

          if (completion.resultCode === 0) {
            const extra = modalType === 1143 ? '（チケット1枚使用）' : modalType === 1042 ? '（他店利用）' : '';
            return NextResponse.json({
              success: true,
              resultCode: 0,
              message: `予約が完了しました${extra}`,
              sheetNo: String(sheetNo),
            });
          }

          return NextResponse.json({
            success: false,
            resultCode: completion.resultCode,
            message: completion.message || `確定エラー (rc=${completion.resultCode})`,
          });
        }

        // 自動完了不可
        const confirmReason = modalType === 1024
          ? '既存予約との差替えが提案されました。FEELCYCLEアプリで手動確認してください。'
          : modalType === 10242
          ? (result.raw.message as string) || 'イベントチケットが必要です。'
          : result.message || `追加操作が必要です (modal_type=${modalType})`;

        return NextResponse.json({
          success: false,
          resultCode: 303,
          message: confirmReason,
          needsManualConfirm: true,
          confirmReason,
        });
      }

      case 205:
        // 競合
        return NextResponse.json({
          success: false,
          resultCode: 205,
          message: 'この座席は他の方に予約されました。座席マップを更新してください。',
        });

      default:
        return NextResponse.json({
          success: false,
          resultCode: result.resultCode,
          message: result.message || `エラーコード: ${result.resultCode}`,
        });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'SESSION_EXPIRED') {
      return NextResponse.json({ error: 'FEELCYCLEセッションが期限切れです', code: 'FC_SESSION_EXPIRED' }, { status: 401 });
    }
    console.error('Reserve API error:', err);
    return NextResponse.json({ error: '予約処理でエラーが発生しました' }, { status: 500 });
  }
}
