import puppeteer from 'puppeteer';
import type { Lesson } from '@/types';

/**
 * FEELCYCLEサイトからレッスン情報をスクレイピング
 *
 * 注意: このスクレイピングは個人利用目的です
 * FEELCYCLEの利用規約を遵守してください
 */

export async function scrapeFeelcycleLessons(): Promise<Lesson[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // モバイルユーザーエージェントを設定
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
    );

    // FEELCYCLEの予約ページにアクセス
    console.log('Accessing FEELCYCLE reserve page...');
    await page.goto('https://m.feelcycle.com/reserve', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // ページが読み込まれるまで待機
    await page.waitForSelector('body', { timeout: 10000 });

    // ページのHTMLを取得（デバッグ用）
    const html = await page.content();
    console.log('Page loaded, HTML length:', html.length);

    // TODO: 実際のレッスン情報を抽出
    // ここでページの構造を確認して、適切なセレクタを使用する必要があります

    // 仮の実装（モックデータ）
    const lessons: Lesson[] = await page.evaluate(() => {
      // TODO: 実際のDOM要素からデータを抽出
      // 例:
      // const lessonElements = document.querySelectorAll('.lesson-item');
      // return Array.from(lessonElements).map(el => ({
      //   id: el.getAttribute('data-id') || '',
      //   date: el.querySelector('.date')?.textContent || '',
      //   ...
      // }));

      // 現時点ではモックデータを返す
      return [];
    });

    console.log(`Scraped ${lessons.length} lessons`);
    return lessons;

  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * レッスンデータの検証
 */
function validateLesson(lesson: any): lesson is Lesson {
  return (
    typeof lesson.id === 'string' &&
    typeof lesson.date === 'string' &&
    typeof lesson.time === 'string' &&
    typeof lesson.programName === 'string' &&
    typeof lesson.instructor === 'string' &&
    typeof lesson.studio === 'string'
  );
}

/**
 * デバッグ用: ページのスクリーンショットを保存
 */
export async function debugScraping() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  );

  await page.goto('https://m.feelcycle.com/reserve', {
    waitUntil: 'networkidle2',
  });

  // スクリーンショット保存
  await page.screenshot({ path: '/tmp/feelcycle-debug.png' });

  // HTMLを保存
  const html = await page.content();
  console.log('HTML Preview (first 500 chars):');
  console.log(html.substring(0, 500));

  await browser.close();
}
