"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Lesson } from "@/types";

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/lessons');
      const data = await response.json();

      if (data.success) {
        setLessons(data.data);
      } else {
        setError('レッスン情報の取得に失敗しました');
      }
    } catch (err) {
      setError('レッスン情報の取得中にエラーが発生しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-primary-700">Feel Hub</h1>
            <nav className="flex gap-4">
              <Link href="/" className="text-gray-600 hover:text-primary-700">
                トップ
              </Link>
              <Link href="/login" className="text-gray-600 hover:text-primary-700">
                ログイン
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">レッスン一覧</h2>
          <p className="text-gray-600">
            FEELCYCLEのレッスン情報（モックデータ表示中）
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">レッスン情報を読み込み中...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Lessons List */}
        {!loading && !error && lessons.length > 0 && (
          <div className="space-y-4">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {lesson.programName}
                      </h3>
                      {lesson.isFull ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded">
                          満席
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                          空きあり
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="font-medium text-gray-700">日時</p>
                        <p>{lesson.date} {lesson.time}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">スタジオ</p>
                        <p>{lesson.studio}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">インストラクター</p>
                        <p>{lesson.instructor}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">空き状況</p>
                        <p>
                          {lesson.availableSlots} / {lesson.totalSlots} 枠
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-4">
                    {lesson.isFull ? (
                      <button
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-sm font-semibold"
                      >
                        キャンセル待ち
                      </button>
                    ) : (
                      <button
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-semibold"
                      >
                        予約する
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && lessons.length === 0 && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">レッスン情報がありません</p>
          </div>
        )}
      </main>
    </div>
  );
}
