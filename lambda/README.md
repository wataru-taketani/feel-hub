# Feel Hub - AWS Lambda Functions

FEELCYCLEのスクレイピングとキャンセル待ち通知を行うLambda関数

## セットアップ

### 1. 依存関係のインストール

```bash
cd lambda
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成して以下を設定:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ENCRYPTION_KEY=your_encryption_key
```

### 3. AWS認証情報の設定

```bash
aws configure
```

または、環境変数で設定:

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=ap-northeast-1
```

## デプロイ

### 開発環境へのデプロイ

```bash
npm run deploy:dev
```

### 本番環境へのデプロイ

```bash
npm run deploy:prod
```

## ローカルテスト

### スクレイピング関数のテスト

```bash
npm run invoke:scrape
```

### ログの確認

```bash
npm run logs
```

## Lambda関数

### 1. scrapeLesson

- **説明**: FEELCYCLEサイトからレッスン情報をスクレイピング
- **実行**: 毎日午前6時（JST）= 21:00 UTC
- **タイムアウト**: 15分
- **メモリ**: 1024MB（Puppeteer用に増量）
- **初期状態**: 無効（`enabled: false`）

### 2. checkCancellation

- **説明**: キャンセル待ちレッスンの空き枠をチェック
- **実行**: 毎分（Phase 3で有効化）
- **タイムアウト**: 15分
- **メモリ**: 1024MB

## コスト見積もり

### Lambda実行時間
- scrapeLesson: 1日1回 × 30秒 = 月30回
- checkCancellation: 1分ごと × 43,200回/月 × 5秒

### 無料枠（月間）
- 100万リクエスト
- 40万GB-秒のコンピューティング時間

**見積もり**: ほぼ無料枠内で収まる（月額 $0-2程度）

## トラブルシューティング

### デプロイエラー

```bash
# Serverless Frameworkの再インストール
npm install -g serverless@4
```

### Puppeteer/Chromiumのエラー

Lambdaでは`@sparticuz/chromium`を使用しています。ローカルテストでエラーが出る場合は、通常のPuppeteerを使用してください。

## 技術スタック

- **Runtime**: Node.js 22.x
- **Framework**: Serverless Framework v4
- **言語**: TypeScript（serverless-plugin-typescriptで自動コンパイル）
- **スクレイピング**: Puppeteer + @sparticuz/chromium（Lambda最適化）
- **データベース**: Supabase（PostgreSQL）

## Phase別実装状況

- **Phase 1**: ✅ 完了（Lambda設定とテンプレート）
- **Phase 2**: ✅ 完了（レッスンUI表示）
- **Phase 3**: 🚧 実装中（Puppeteerスクレイピング構造完成、DOM解析待ち）
- **Phase 4**: キャンセル待ち通知実装予定
- **Phase 5**: 自動予約実装予定

## ⚠️ 重要事項

### 初回デプロイ後の確認

1. **EventBridgeスケジュールの有効化**
   - デプロイ直後はスケジュール無効（`enabled: false`）
   - ログを確認して正常動作を確認後、手動で有効化

2. **Puppeteerの動作確認**
   - Lambda環境では@sparticuz/chromiumを使用
   - 最初のコールドスタート時は起動に時間がかかる可能性あり

3. **RLS（Row Level Security）について**
   - Lambda側は`service_role`キーを使用してRLSをバイパス
   - すべてのユーザーのレッスンデータを更新可能
