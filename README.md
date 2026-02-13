# Feel Hub

FEELCYCLEライフをもっと快適にするWebサービス

## 概要

Feel HubはFEELCYCLE（https://www.feelcycle.com/）の利用をサポートする非公式ツールです。
人気レッスンのキャンセル待ち通知、自動予約、受講履歴分析などの機能を提供します。

## 主な機能

### Phase 1: Webサービスの基盤構築 ✅
- [x] Next.js 15 + TypeScript + Tailwind CSSのセットアップ
- [x] Supabase SSR対応（@supabase/ssr使用）
- [x] 基本的なUI（トップページ、ログイン画面）
- [x] AWS Lambda設定（Serverless Framework）
- [x] データベーススキーマ定義
- [x] プロジェクト構造の構築

### Phase 2: レッスン情報取得 ✅
- [x] FEELCYCLE内部APIからレッスン取得（Lambda + EventBridge 10分毎）
- [x] レッスンデータのDB保存（Supabase upsert）
- [x] レッスン一覧カレンダーUI（スタジオ別・プログラム検索・ピン固定）

### Phase 3: キャンセル待ち・LINE通知 ✅
- [x] 空き通知（waitlist）登録UI + レッスン詳細モーダル
- [x] キャンセル検知Lambda（毎分実行・ウォッチ対象API直接取得）
- [x] LINE Messaging APIプッシュ通知
- [x] LINE Login OAuth連携（自動LINE User ID取得）

### Phase 4: 公式サイトログイン連携 ✅
- [x] FEELCYCLE認証情報の暗号化保存（AES暗号化 → Supabase）
- [x] マイページ情報取得（予約・チケット・会員情報）
- [x] 受講履歴の同期・月別表示
- [x] ダッシュボード（予約一覧・サブスク残・チケット期限・空き通知）

### Phase 5: 自動予約（予定）
- [ ] FEELCYCLE APIを使った自動予約機能

## 技術スタック

### フロントエンド
- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Vercel** でホスティング

### バックエンド
- **Vercel API Routes** (軽量API)
- **AWS Lambda** (スクレイピング・重い処理、タイムアウト15分)
- **AWS EventBridge** (定期実行スケジューラ)
- **Serverless Framework** (Lambda デプロイ管理)

### データベース・認証
- **Supabase** (PostgreSQL + Row Level Security)
- **@supabase/ssr** (Next.js 15 App Router対応)

### その他
- **crypto-js** (FEELCYCLE認証情報の暗号化)
- **LINE Messaging API** (空き通知プッシュ)
- **LINE Login** (OAuth連携)

## セットアップ

### 前提条件
- Node.js 20以上
- npm または yarn
- Supabaseアカウント（無料）
- AWSアカウント（Phase 2以降）

### 環境変数の設定

`.env.example`をコピーして`.env.local`を作成:

```bash
cp .env.example .env.local
```

以下の環境変数を設定:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Encryption
ENCRYPTION_KEY=your_random_32_character_string

# LINE
LINE_LOGIN_CHANNEL_ID=your_line_login_channel_id
LINE_LOGIN_CHANNEL_SECRET=your_line_login_channel_secret
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
```

### インストールと起動

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm start
```

開発サーバーは http://localhost:3000 で起動します。

## Vercelへのデプロイ

1. GitHubリポジトリと連携
2. Vercelプロジェクト作成
3. 環境変数を設定
4. `main`ブランチにpushすると自動デプロイ

詳細は[Vercel公式ドキュメント](https://vercel.com/docs)を参照。

## プロジェクト構造

```
feel-hub/
├── app/                   # Next.js App Router
│   ├── login/            # ログインページ
│   ├── lessons/          # レッスン一覧ページ
│   ├── layout.tsx        # ルートレイアウト
│   └── page.tsx          # トップページ
├── components/           # 再利用可能なコンポーネント
├── lib/                  # ライブラリ設定
│   └── supabase/         # Supabaseクライアント（SSR対応）
│       ├── client.ts     # クライアントコンポーネント用
│       ├── server.ts     # サーバーコンポーネント用
│       └── middleware.ts # ミドルウェア用
├── lambda/               # AWS Lambda関数
│   ├── scraper/          # スクレイピング関数
│   ├── serverless.yml    # Serverless Framework設定
│   └── package.json      # Lambda用依存関係
├── supabase/             # Supabaseスキーマ
│   ├── schema.sql        # データベーススキーマ
│   └── README.md         # Supabaseセットアップ手順
├── types/                # TypeScript型定義
├── utils/                # ユーティリティ関数（暗号化など）
├── middleware.ts         # Next.js ミドルウェア
├── .env.example          # 環境変数テンプレート
└── README.md
```

詳細なセットアップ手順:
- **Supabase**: `supabase/README.md` を参照
- **AWS Lambda**: `lambda/README.md` を参照

## コスト見積もり（月額）

| サービス | プラン | コスト |
|---------|--------|--------|
| **Vercel** | Hobby（無料） | $0 |
| **Supabase** | Free（500MB DB） | $0 |
| **AWS Lambda** | 無料枠 + 追加実行 | $1-3 |
| **AWS EventBridge** | 無料枠内 | $0 |
| **LINE Messaging API** | Free | $0 |

**合計: $1-3/月**（ほぼ無料枠内で運用可能）

### Lambda実行回数見積もり
- レッスンスクレイピング: 1日1回 × 30日 = 月30回
- キャンセル待ちチェック: 毎分実行 × 43,200分/月 = 43,200回
- 無料枠: 100万リクエスト/月 → **十分に収まる**

## ライセンス

個人利用目的のプロジェクトです。

## 免責事項

このツールはFEELCYCLEの非公式ツールであり、FEELCYCLE公式とは一切関係ありません。
利用は自己責任でお願いします。
