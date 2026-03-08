import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerSupabase } from '@/lib/supabase/server';
import { reserveLesson, reserveCompletion } from '@/lib/feelcycle-api';
import { getFcSession, reauthSession } from '@/lib/fc-session';
import type { FeelcycleSession } from '@/lib/feelcycle-api';

async function executeReserve(fcSession: FeelcycleSession, sidHash: string, sheetNo: string) {
  const result = await reserveLesson(fcSession, sidHash, String(sheetNo));

  switch (result.resultCode) {
    case 0:
      return NextResponse.json({
        success: true,
        resultCode: 0,
        message: '予約が完了しました',
        sheetNo: String(sheetNo),
      });

    case 303: {
      const modalType = Number(result.raw.modal_type ?? 0);
      const tmpLessonId = result.raw.tmp_lesson_id as string | undefined;

      if (tmpLessonId && (modalType === 1042 || modalType === 1143 || modalType === 1024)) {
        let ticketType: number | undefined;
        if (modalType === 1143) {
          const tickets = result.raw.consumption_ticket_list as Array<{ ticket_type?: number }> | undefined;
          ticketType = tickets?.[0]?.ticket_type;
        }

        const completion = await reserveCompletion(fcSession, tmpLessonId, ticketType);

        if (completion.resultCode === 0) {
          const extra = modalType === 1024 ? '（振替）' : modalType === 1143 ? '（チケット1枚使用）' : modalType === 1042 ? '（他店利用）' : '';
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
      return NextResponse.json({
        success: false,
        resultCode: 205,
        message: 'このバイクは他の方に予約されました。マップを更新してください。',
      });

    default:
      return NextResponse.json({
        success: false,
        resultCode: result.resultCode,
        message: result.message || `エラーコード: ${result.resultCode}`,
      });
  }
}

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

  const sessionResult = await getFcSession(user.id);
  if (!sessionResult.ok) {
    const status = sessionResult.code === 'FC_NOT_LINKED' ? 404 : 401;
    return NextResponse.json({ error: sessionResult.error, code: sessionResult.code }, { status });
  }

  try {
    return await executeReserve(sessionResult.session, sidHash, sheetNo);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'SESSION_EXPIRED') {
      // 自動再認証してリトライ
      const reauth = await reauthSession(user.id);
      if (!reauth.ok) {
        return NextResponse.json({ error: reauth.error, code: reauth.code }, { status: 401 });
      }
      try {
        return await executeReserve(reauth.session, sidHash, sheetNo);
      } catch (retryErr) {
        console.error('Reserve retry after reauth failed:', retryErr);
        return NextResponse.json({ error: '予約処理でエラーが発生しました' }, { status: 500 });
      }
    }
    console.error('Reserve API error:', err);
    return NextResponse.json({ error: '予約処理でエラーが発生しました' }, { status: 500 });
  }
}
