import { NextResponse } from 'next/server';
import type { Lesson } from '@/types';

/**
 * レッスン一覧取得API
 *
 * GET /api/lessons
 *
 * Phase 2: モックデータを返す
 * Phase 3: Supabaseから実際のデータを取得
 */
export async function GET() {
  try {
    // モックデータ（Phase 2用）
    const mockLessons: Lesson[] = [
      {
        id: '1',
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
        id: '2',
        date: '2025-11-09',
        time: '11:30',
        programName: 'BB2 Shape',
        instructor: '佐藤 花子',
        studio: '渋谷',
        availableSlots: 0,
        totalSlots: 20,
        isFull: true,
        url: 'https://m.feelcycle.com/reserve',
      },
      {
        id: '3',
        date: '2025-11-09',
        time: '14:00',
        programName: 'HH1 Hip Hop',
        instructor: '鈴木 次郎',
        studio: '新宿',
        availableSlots: 12,
        totalSlots: 20,
        isFull: false,
        url: 'https://m.feelcycle.com/reserve',
      },
      {
        id: '4',
        date: '2025-11-09',
        time: '18:00',
        programName: 'BSL Body Shape Lower',
        instructor: '田中 美咲',
        studio: '渋谷',
        availableSlots: 2,
        totalSlots: 20,
        isFull: false,
        url: 'https://m.feelcycle.com/reserve',
      },
      {
        id: '5',
        date: '2025-11-09',
        time: '19:30',
        programName: 'BSW Body Shape Waist',
        instructor: '山田 太郎',
        studio: '新宿',
        availableSlots: 0,
        totalSlots: 20,
        isFull: true,
        url: 'https://m.feelcycle.com/reserve',
      },
      {
        id: '6',
        date: '2025-11-10',
        time: '09:00',
        programName: 'BB1 Beginner',
        instructor: '高橋 愛',
        studio: '渋谷',
        availableSlots: 8,
        totalSlots: 20,
        isFull: false,
        url: 'https://m.feelcycle.com/reserve',
      },
      {
        id: '7',
        date: '2025-11-10',
        time: '12:00',
        programName: 'BSB Body Shape Back',
        instructor: '伊藤 健',
        studio: '新宿',
        availableSlots: 15,
        totalSlots: 20,
        isFull: false,
        url: 'https://m.feelcycle.com/reserve',
      },
      {
        id: '8',
        date: '2025-11-10',
        time: '20:00',
        programName: 'BB3 Advance',
        instructor: '佐藤 花子',
        studio: '渋谷',
        availableSlots: 0,
        totalSlots: 20,
        isFull: true,
        url: 'https://m.feelcycle.com/reserve',
      },
    ];

    return NextResponse.json({
      success: true,
      data: mockLessons,
      count: mockLessons.length,
    });

  } catch (error) {
    console.error('Error fetching lessons:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch lessons',
      },
      { status: 500 }
    );
  }
}
