import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <main className="text-center px-4">
        <h1 className="text-5xl font-bold text-primary-700 mb-4">
          Feel Hub
        </h1>
        <p className="text-xl text-gray-700 mb-8">
          FEELCYCLEライフをもっと快適に
        </p>

        <div className="space-y-4">
          <p className="text-gray-600 max-w-md mx-auto">
            人気レッスンのキャンセル待ち通知、自動予約、受講履歴分析など、<br />
            FEELCYCLEをもっと楽しむための機能を提供します
          </p>

          <div className="flex gap-4 justify-center mt-8">
            <Link
              href="/login"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold"
            >
              ログイン
            </Link>
            <Link
              href="/lessons"
              className="px-6 py-3 bg-white text-primary-600 border-2 border-primary-600 rounded-lg hover:bg-primary-50 transition-colors font-semibold"
            >
              レッスン一覧を見る
            </Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-primary-700 mb-2">
              キャンセル待ち通知
            </h3>
            <p className="text-gray-600 text-sm">
              満席レッスンに空きが出たら即座にLINE通知
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-primary-700 mb-2">
              自動予約
            </h3>
            <p className="text-gray-600 text-sm">
              空き枠を検知したら自動で予約を完了
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-primary-700 mb-2">
              受講履歴分析
            </h3>
            <p className="text-gray-600 text-sm">
              プログラムやインストラクターの統計データを可視化
            </p>
          </div>
        </div>
      </main>

      <footer className="mt-16 text-gray-500 text-sm">
        <p>Feel Hub - FEELCYCLEの非公式サポートツール</p>
      </footer>
    </div>
  );
}
