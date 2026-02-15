# Feel Hub

FEELCYCLEライフをもっと快適にするWebサービス

## 概要

Feel HubはFEELCYCLE（https://www.feelcycle.com/）の利用をサポートする非公式ツールです。
レッスン検索、予約状況確認、キャンセル待ち通知、自動予約などの機能を提供します。

**本番URL**: https://feel-hub.vercel.app

## 実装済み機能

### Phase 1-2: レッスン情報取得・表示
- FEELCYCLE内部APIから全スタジオのレッスンを自動取得（Lambda + EventBridge 10分毎）
- レッスン一覧カレンダーUI（スタジオ別・プログラム検索・ピン固定）
- 座席マップ表示・バイク番号表示

### Phase 3: キャンセル待ち・LINE通知
- 空き通知（waitlist）登録UI + レッスン詳細モーダル
- キャンセル検知Lambda（毎分実行・DB値参照で空き判定）
- LINE Messaging APIプッシュ通知

### Phase 4: 公式サイトログイン連携
- LINE Login OAuth連携（主認証方式）
- FEELCYCLE認証情報の暗号化保存（AES-256-GCM）
- マイページ情報取得（予約・チケット・会員情報）
- 受講履歴の同期・月別表示
- ダッシュボード（予約一覧・サブスク残・チケット期限・キャンセル待ち状況）

### Phase 5: 自動予約（Step 1）
- キャンセル待ちレッスンの空き検知時に自動予約（所属店舗×通常レッスン）
- FC認証情報を復号 → ログイン → 座席マップ取得 → 空席選択 → 予約実行
- 結果に応じたLINE通知（成功/要確認/失敗）
- ダッシュボードで自動予約 vs 通知のみの区別表示

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フロントエンド | Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui |
| 認証 | Supabase Auth（LINE Login経由、ダミーemail方式） |
| DB | Supabase (PostgreSQL + RLS) |
| バックエンド | Next.js API Routes + AWS Lambda (Serverless Framework v4) |
| 通知 | LINE Messaging API |
| ホスティング | Vercel (フロント) + AWS Lambda ap-northeast-1 (定期実行) |
| 暗号化 | AES-256-GCM (Node.js crypto) |

## プロジェクト構造

```
feel-hub/
├── app/                    # Next.js App Router
│   ├── api/                # API Routes
│   │   ├── auth/           # 認証 (line/, feelcycle-link/, feelcycle-reauth/)
│   │   ├── dashboard/      # ダッシュボードデータ
│   │   ├── lessons/        # レッスン一覧
│   │   ├── bookmarks/      # ブックマーク管理
│   │   ├── seatmap/        # 座席マップ取得
│   │   ├── mypage/         # マイページデータ
│   │   └── waitlist/       # キャンセル待ち管理
│   ├── lessons/            # レッスン一覧ページ
│   ├── login/              # ログインページ (LINE Login)
│   ├── mypage/             # マイページ
│   └── history/            # 受講履歴
├── components/             # UIコンポーネント
│   ├── lessons/            # レッスン関連 (カレンダー, カード, モーダル, 座席マップ)
│   └── ui/                 # shadcn/ui コンポーネント
├── hooks/                  # カスタムフック (useWaitlist, useBookmarks)
├── lib/                    # ユーティリティ
│   ├── feelcycle-api.ts    # FEELCYCLE API クライアント
│   ├── crypto.ts           # 暗号化 (AES-256-GCM)
│   └── supabase/           # Supabase クライアント
├── lambda/                 # AWS Lambda 関数
│   └── scraper/
│       ├── index.ts        # メインスクレイパー (10分毎)
│       ├── checkCancellation.ts  # キャンセル待ちチェック (毎分)
│       ├── autoReserve.ts  # 自動予約ロジック
│       └── fcClient.ts     # FEELCYCLE認証・予約APIクライアント
├── contexts/               # React Context (AuthContext)
├── types/                  # TypeScript 型定義
└── supabase/               # DBマイグレーション
```

## 開発コマンド

```bash
# フロントエンド
npm run dev              # ローカル開発サーバー
npm run build            # ビルド確認

# Lambda
cd lambda
npx tsc                  # TypeScript ビルド
npx serverless deploy --stage prod  # 本番デプロイ

# デプロイ
git push                 # Vercel自動デプロイ（フロント + API）
```

## 環境変数

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Encryption
ENCRYPTION_KEY=your_random_32_character_string

# LINE Login
LINE_LOGIN_CHANNEL_ID=your_line_login_channel_id
LINE_LOGIN_CHANNEL_SECRET=your_line_login_channel_secret

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
```

## 認証フロー

1. `/login` → LINE Login → `/api/auth/line/callback` → Supabase Auth ユーザー作成
2. マイページでFEELCYCLE連携（メール+パスワード → AES-256-GCM暗号化保存）
3. セッション期限切れ時は `/api/auth/feelcycle-reauth` で自動再認証

## コスト見積もり（月額）

| サービス | プラン | コスト |
|---------|--------|--------|
| Vercel | Hobby（無料） | $0 |
| Supabase | Free（500MB DB） | $0 |
| AWS Lambda | 無料枠内 | $0-3 |
| LINE Messaging API | Free | $0 |

**合計: $0-3/月**

## ライセンス

個人利用目的のプロジェクトです。

## 免責事項

このツールはFEELCYCLEの非公式ツールであり、FEELCYCLE公式とは一切関係ありません。
利用は自己責任でお願いします。
