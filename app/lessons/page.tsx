"use client";

import Link from "next/link";

export default function LessonsPage() {
  // TODO: Phase 2でスクレイピングしたレッスンデータを表示

  return (
    <div className="min-h-screen bg-gray-50">
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

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">レッスン一覧</h2>
          <p className="text-gray-600">
            FEELCYCLEのレッスン情報を確認できます（Phase 2で実装予定）
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              レッスン情報取得機能は準備中
            </h3>
            <p className="text-gray-600 mb-6">
              Phase 2でスクレイピング機能を実装し、<br />
              FEELCYCLEのレッスン情報を表示します
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>✓ レッスン日時・プログラム名</p>
              <p>✓ インストラクター情報</p>
              <p>✓ 空き状況</p>
              <p>✓ キャンセル待ち登録</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
