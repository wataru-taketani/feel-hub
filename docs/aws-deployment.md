# AWS Lambda デプロイ手順

Feel HubのスクレイピングLambda関数をAWSにデプロイする手順です。

## 📋 前提条件

- AWSアカウント（既に保有済み）
- Node.js 22.x以上
- npm

## 🚀 デプロイ手順

### Step 1: AWS認証情報の取得

1. **AWSマネジメントコンソールにログイン**
   - https://console.aws.amazon.com/

2. **IAMユーザーの作成（または既存ユーザーを使用）**
   - IAM > ユーザー > ユーザーを作成
   - ユーザー名: `feel-hub-deployer` など
   - 「プログラムによるアクセス」を有効化

3. **権限を付与**
   以下のポリシーをアタッチ:
   - `AWSLambdaFullAccess` - Lambda関数の作成・更新
   - `IAMFullAccess` - Lambda実行ロールの作成
   - `AmazonEventBridgeFullAccess` - スケジュール設定
   - `CloudWatchLogsFullAccess` - ログの確認

   または、カスタムポリシーを作成して最小権限で運用:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "lambda:*",
           "iam:CreateRole",
           "iam:AttachRolePolicy",
           "iam:PassRole",
           "events:*",
           "logs:*",
           "cloudformation:*",
           "s3:*"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

4. **アクセスキーを取得**
   - 「セキュリティ認証情報」タブ
   - 「アクセスキーを作成」
   - **Access Key ID**と**Secret Access Key**をコピー（この画面を閉じると二度と見られません！）

### Step 2: AWS CLIの設定

```bash
# AWS CLIがインストールされているか確認
aws --version

# インストールされていない場合（Macの場合）
brew install awscli

# 認証情報を設定
aws configure
```

入力する情報:
```
AWS Access Key ID [None]: AKIA... （Step 1で取得）
AWS Secret Access Key [None]: wJalr... （Step 1で取得）
Default region name [None]: ap-northeast-1 （東京リージョン）
Default output format [None]: json
```

設定を確認:
```bash
aws sts get-caller-identity
```

正常に設定されている場合、以下のようなJSON出力が表示されます:
```json
{
  "UserId": "AIDAI...",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/feel-hub-deployer"
}
```

### Step 3: Lambda依存関係のインストール

```bash
cd lambda
npm install
```

インストールされる主要パッケージ:
- `@supabase/supabase-js` - Supabase接続
- `puppeteer-core` - ブラウザ自動化
- `@sparticuz/chromium` - Lambda用Chromium
- `serverless-plugin-typescript` - TypeScriptコンパイル

### Step 4: デプロイ実行

```bash
# 開発環境にデプロイ
npm run deploy:dev
```

初回デプロイは5-10分程度かかります。以下のような出力が表示されます:

```
Deploying feel-hub-lambda to stage dev (ap-northeast-1)

✔ Service deployed to stack feel-hub-lambda-dev (152s)

functions:
  scrapeLesson: feel-hub-lambda-dev-scrapeLesson (1.5 MB)
  checkCancellation: feel-hub-lambda-dev-checkCancellation (1.5 MB)

endpoints:
  None

Stack Outputs:
  ScrapeLessonLambdaFunctionQualifiedArn: arn:aws:lambda:ap-northeast-1:123456789012:function:feel-hub-lambda-dev-scrapeLesson:1
```

### Step 5: デプロイ後の確認

1. **Lambda関数の確認**
   ```bash
   aws lambda list-functions --region ap-northeast-1
   ```

2. **手動実行テスト**
   ```bash
   # ローカルでテスト
   npm run invoke:scrape
   ```

   または、AWS CLIで実行:
   ```bash
   aws lambda invoke \
     --function-name feel-hub-lambda-dev-scrapeLesson \
     --region ap-northeast-1 \
     --log-type Tail \
     output.json
   ```

3. **ログの確認**
   ```bash
   # Serverless Frameworkで確認
   npm run logs

   # またはAWS CLIで確認
   aws logs tail /aws/lambda/feel-hub-lambda-dev-scrapeLesson --follow
   ```

### Step 6: スケジュールの有効化

初回デプロイ時は、EventBridgeスケジュールが無効になっています（`enabled: false`）。

正常動作を確認後、以下の手順で有効化:

1. **serverless.ymlを編集**
   ```yaml
   functions:
     scrapeLesson:
       events:
         - schedule:
             enabled: true  # falseからtrueに変更
   ```

2. **再デプロイ**
   ```bash
   npm run deploy:dev
   ```

3. **スケジュールの確認**
   - AWSコンソール > EventBridge > ルール
   - `feel-hub-lambda-dev-scrapeLesson-schedule-*` というルールが作成されている
   - 「有効」になっていることを確認

## 💰 料金見積もり

### Lambda料金（2025年1月現在）

- **無料枠（月間）**:
  - 100万リクエスト
  - 400,000 GB-秒のコンピューティング時間

- **見積もり（scrapeLesson）**:
  - 実行回数: 30回/月（1日1回）
  - メモリ: 1024MB = 1GB
  - 実行時間: 約2分/回（推定）
  - GB-秒: 1GB × 120秒 × 30回 = 3,600 GB-秒
  - **料金: 無料枠内**

- **見積もり（checkCancellation - Phase 4で有効化）**:
  - 実行回数: 43,200回/月（1分ごと）
  - メモリ: 1024MB = 1GB
  - 実行時間: 約5秒/回（推定）
  - GB-秒: 1GB × 5秒 × 43,200回 = 216,000 GB-秒
  - **料金: 無料枠内**

**合計見積もり: $0-2/月**（ほぼ無料枠内）

### その他のAWS料金

- CloudWatch Logs: 少量のため無料枠内
- EventBridge: 少量のため無料枠内
- データ転送: 少量のため無料枠内

## 🔧 トラブルシューティング

### エラー: "The security token included in the request is invalid"

**原因**: AWS認証情報が正しく設定されていない

**解決策**:
```bash
aws configure
# Access Key IDとSecret Access Keyを再入力
```

### エラー: "Rate exceeded"

**原因**: Lambda関数のデプロイ頻度が高すぎる

**解決策**: 数分待ってから再試行

### エラー: "Handler 'scraper/index.handler' missing"

**原因**: TypeScriptのコンパイルに失敗

**解決策**:
```bash
cd lambda
rm -rf node_modules package-lock.json
npm install
npm run deploy:dev
```

### Puppeteerのタイムアウトエラー

**原因**: メモリ不足またはネットワーク遅延

**解決策**:
1. `serverless.yml`でメモリを増やす:
   ```yaml
   provider:
     memorySize: 2048  # 1024から2048に増量
   ```

2. タイムアウトを調整:
   ```yaml
   provider:
     timeout: 900  # 最大15分
   ```

### "Cannot find module '@sparticuz/chromium'"

**原因**: 依存関係のインストール漏れ

**解決策**:
```bash
cd lambda
npm install
```

## 📊 監視とメンテナンス

### CloudWatch Metricsで監視

- **Invocations**: 実行回数
- **Duration**: 実行時間
- **Errors**: エラー回数
- **Throttles**: 制限された回数

### アラートの設定（推奨）

1. AWSコンソール > CloudWatch > アラーム
2. 「アラームの作成」
3. 監視メトリクス: Lambda > 関数メトリクス > Errors
4. 条件: エラー数 > 5（5分間）
5. アクション: SNSトピックでメール通知

### 定期的な確認

- **週次**: ログを確認してエラーがないかチェック
- **月次**: CloudWatch Metricsで実行時間やエラー率を確認
- **料金**: AWSコストエクスプローラーで月次料金を確認

## 🎯 次のステップ

1. ✅ Lambda関数のデプロイ完了
2. 🔄 実際のDOM解析ロジックを実装（FEELCYCLEサイトの構造確認後）
3. 🔄 Supabaseへのデータ保存を実装
4. 🔄 フロントエンドをSupabaseデータに接続
5. 📱 Phase 4: LINE通知機能の実装
6. 🤖 Phase 5: 自動予約機能の実装

## 📚 参考リンク

- [Serverless Framework公式ドキュメント](https://www.serverless.com/framework/docs)
- [AWS Lambda料金](https://aws.amazon.com/jp/lambda/pricing/)
- [@sparticuz/chromium](https://github.com/Sparticuz/chromium)
- [Puppeteer公式ドキュメント](https://pptr.dev/)
