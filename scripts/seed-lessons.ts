/**
 * スクレイピング済みデータをSupabaseに投入するスクリプト
 *
 * 使い方:
 *   npx tsx scripts/seed-lessons.ts
 *   または node で直接実行:
 *   node scripts/seed-lessons.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('環境変数が設定されていません。.env.local を確認してください。');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ScrapedLesson {
  date: string;
  startTime: string;
  endTime: string;
  programName: string;
  instructor: string;
  studio: string;
  isFull: boolean;
}

async function main() {
  const outputPath = path.join(__dirname, '..', 'lambda', 'output.json');
  const raw = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  const body = JSON.parse(raw.body);
  const lessons: ScrapedLesson[] = body.lessons;

  console.log(`読み込み完了: ${lessons.length} 件のレッスンデータ`);

  // 既存スキーマに合わせて変換
  const rows = lessons.map((l) => ({
    date: l.date,
    time: l.startTime,
    program_name: l.programName,
    instructor: l.instructor,
    studio: l.studio,
    is_full: l.isFull,
    available_slots: l.isFull ? 0 : 1,
    total_slots: 20,
    url: 'https://m.feelcycle.com/reserve',
  }));

  // 500件ずつバッチupsert
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('lessons')
      .upsert(batch, { onConflict: 'date,time,studio,instructor' });

    if (error) {
      console.error(`バッチ ${Math.floor(i / BATCH_SIZE) + 1} でエラー:`, error.message);
      continue;
    }

    inserted += batch.length;
    console.log(`  ${inserted} / ${rows.length} 件投入完了`);
  }

  // 確認
  const { count } = await supabase
    .from('lessons')
    .select('*', { count: 'exact', head: true });

  console.log(`\n完了! Supabase lessons テーブル: ${count} 件`);
}

main().catch(console.error);
