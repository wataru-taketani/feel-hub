import { Handler } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * FEELCYCLEレッスン情報スクレイピング Lambda関数
 *
 * Phase 2で実装予定:
 * - FEELCYCLEの予約サイト（https://m.feelcycle.com/reserve）からレッスン情報を取得
 * - Supabaseにレッスンデータを保存
 * - 既存データとの差分を検知
 */

interface LessonData {
  date: string;
  time: string;
  programName: string;
  instructor: string;
  studio: string;
  availableSlots: number;
  totalSlots: number;
  isFull: boolean;
  url: string;
}

export const handler: Handler = async (event, context) => {
  console.log('Lambda function started', { event, context });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Phase 2で実装: FEELCYCLEサイトのスクレイピング
    const lessons = await scrapeLessons();

    // Supabaseにデータ保存
    const { data, error } = await supabase
      .from('lessons')
      .upsert(lessons, { onConflict: 'date,time,studio' });

    if (error) {
      throw error;
    }

    console.log(`Successfully scraped and saved ${lessons.length} lessons`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Scraping completed successfully',
        count: lessons.length,
      }),
    };
  } catch (error) {
    console.error('Error in scraping:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Scraping failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};

/**
 * FEELCYCLEサイトからレッスン情報をスクレイピング
 * Phase 2で実装予定
 */
async function scrapeLessons(): Promise<LessonData[]> {
  // TODO: Phase 2で実装
  // 1. FEELCYCLEの予約ページにアクセス
  // 2. HTMLをパース
  // 3. レッスン情報を抽出
  // 4. LessonData形式に変換

  console.log('Scraping lessons from FEELCYCLE website...');

  // 仮のデータ（Phase 2で実装）
  const mockLessons: LessonData[] = [
    {
      date: '2025-11-06',
      time: '10:00',
      programName: 'BB1',
      instructor: 'Sample Instructor',
      studio: 'Shibuya',
      availableSlots: 5,
      totalSlots: 20,
      isFull: false,
      url: 'https://m.feelcycle.com/reserve',
    },
  ];

  return mockLessons;
}
