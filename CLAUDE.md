# Feel Hub - Claude Code 開発ガイド

## プロジェクト概要
FEELCYCLEレッスン情報管理アプリ。レッスン検索、予約状況確認、キャンセル待ち通知をLINE経由で提供。

## 技術スタック
- **フロントエンド**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **認証**: Supabase Auth（LINE Login経由、ダミーemail方式）
- **DB**: Supabase (PostgreSQL)
- **バックエンド**: Next.js API Routes + AWS Lambda (serverless v4)
- **通知**: LINE Messaging API
- **ホスティング**: Vercel (フロント) + AWS Lambda (定期実行)

## ディレクトリ構成
```
app/                    # Next.js App Router
  api/                  # API Routes
    auth/               # 認証関連 (line/, feelcycle-link/, feelcycle-reauth/)
    dashboard/          # ダッシュボードデータ
    lessons/            # レッスン一覧
    mypage/             # マイページデータ
    waitlist/           # キャンセル待ち管理
  lessons/              # レッスン一覧ページ
  login/                # ログインページ (LINE Login のみ)
  mypage/               # マイページ
  history/              # 受講履歴
components/             # UIコンポーネント
  lessons/              # レッスン関連コンポーネント
  ui/                   # shadcn/ui コンポーネント
hooks/                  # カスタムフック (useWaitlist等)
lib/                    # ユーティリティ
  feelcycle-api.ts      # FEELCYCLE API クライアント
  crypto.ts             # 暗号化 (AES-256-GCM)
  supabase/             # Supabase クライアント
lambda/                 # AWS Lambda 関数
  scraper/              # スクレイピング + キャンセル待ちチェック
contexts/               # React Context (AuthContext)
types/                  # TypeScript 型定義
supabase/migrations/    # DBマイグレーション
```

## 開発コマンド
```bash
npm run dev              # ローカル開発サーバー
npm run build            # ビルド確認
git push                 # Vercel自動デプロイ

# Lambda
cd lambda
npx tsc                  # TypeScript ビルド
npx serverless deploy --stage prod  # デプロイ
```

## 認証フロー
1. `/login` → LINEでログインボタン → `/api/auth/line` → LINE認可画面
2. LINE callback → `/api/auth/line/callback` → Supabase Auth ユーザー作成/ログイン → `/` にリダイレクト
3. マイページでFEELCYCLE連携（メール+パスワード → 暗号化保存）
4. セッション期限切れ時は `/api/auth/feelcycle-reauth` で自動再認証

## 環境変数
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `LINE_LOGIN_CHANNEL_ID`, `LINE_LOGIN_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`
- `ENCRYPTION_KEY`

## 注意事項
- DB columns: snake_case, TypeScript: camelCase（API routeで変換）
- FEELCYCLE API の日付は `YYYY/MM/DD` → DB保存時に `YYYY-MM-DD` に正規化
- `waitlist` と `user_profiles` に直接FKがない → join不可、分離クエリで対応
- Vercel env vars に改行が混入しないよう注意
