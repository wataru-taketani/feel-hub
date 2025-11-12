import { Handler } from 'aws-lambda';
import { createClient } from '@supabase/supabase-js';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

/**
 * FEELCYCLEレッスン情報スクレイピング Lambda関数
 *
 * AWS Lambda環境でPuppeteerを使用してスクレイピング
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

  let browser = null;

  try {
    // FEELCYCLEサイトのスクレイピング
    const lessons = await scrapeLessons();

    // Supabaseにデータ保存
    const { data, error } = await supabase
      .from('lessons')
      .upsert(lessons, { onConflict: 'date,time,studio,instructor' });

    if (error) {
      throw error;
    }

    console.log(`Successfully scraped and saved ${lessons.length} lessons`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Scraping completed successfully',
        count: lessons.length,
        lessons: lessons,
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
 */
async function scrapeLessons(): Promise<LessonData[]> {
  let browser = null;

  try {
    console.log('Starting Puppeteer browser...');

    // Lambda環境用のChromium設定
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath('/tmp'),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    // モバイルUser-Agent設定
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    );

    console.log('Navigating to FEELCYCLE reserve page...');

    // FEELCYCLEの予約ページにアクセス
    await page.goto('https://m.feelcycle.com/reserve', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    console.log('Page loaded successfully');

    // ページのHTMLを取得（デバッグ用）
    const html = await page.content();
    console.log('HTML length:', html.length);
    console.log('HTML preview (first 500 chars):', html.substring(0, 500));

    // TODO: 実際のDOM要素からレッスン情報を抽出
    // 現時点では、ページの構造が分からないため、デバッグ情報のみ出力
    // 実際のサイト構造を確認後、以下のようなコードで抽出:
    //
    // const lessons = await page.evaluate(() => {
    //   const lessonElements = document.querySelectorAll('.lesson-item');
    //   return Array.from(lessonElements).map(el => ({
    //     date: el.querySelector('.date')?.textContent || '',
    //     time: el.querySelector('.time')?.textContent || '',
    //     programName: el.querySelector('.program')?.textContent || '',
    //     instructor: el.querySelector('.instructor')?.textContent || '',
    //     studio: el.querySelector('.studio')?.textContent || '',
    //     availableSlots: parseInt(el.querySelector('.available')?.textContent || '0'),
    //     totalSlots: 20,
    //     isFull: el.classList.contains('full'),
    //     url: 'https://m.feelcycle.com/reserve',
    //   }));
    // });

    // 暫定: モックデータを返す（実際のDOM解析後に置き換え）
    const mockLessons: LessonData[] = [
      {
        date: '2025-11-09',
        time: '10:00',
        programName: 'BB1 Beginner',
        instructor: '山田 太郎',
        studio: '渋谷',
        availableSlots: 5,
        totalSlots: 20,
        isFull: false,
        url: 'https://m.feelcycle.com/reserve',
      },
      {
        date: '2025-11-09',
        time: '14:00',
        programName: 'BSL Body Shape Lower',
        instructor: '佐藤 花子',
        studio: '新宿',
        availableSlots: 0,
        totalSlots: 20,
        isFull: true,
        url: 'https://m.feelcycle.com/reserve',
      },
    ];

    console.log(`Scraped ${mockLessons.length} lessons (mock data)`);

    return mockLessons;

  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
}
