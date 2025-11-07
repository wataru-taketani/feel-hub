# Feel Hub デプロイ手順書

完全ガイド - Supabase + Vercel セットアップ

---

## 📋 目次

1. [事前準備](#事前準備)
2. [Supabaseセットアップ](#supabaseセットアップ)
3. [Vercelデプロイ](#vercelデプロイ)
4. [動作確認](#動作確認)
5. [トラブルシューティング](#トラブルシューティング)

---

## 事前準備

### 必要なもの
- [ ] GitHubアカウント
- [ ] メールアドレス
- [ ] 15-20分の時間

### リポジトリの確認
現在のブランチ: `claude/feelcycle-hub-setup-011CUnpzBZRzUiz5reJ3jwz6`

このブランチを使用してデプロイします。

---

## Supabaseセットアップ

### Step 1: アカウント作成とプロジェクト作成

1. **Supabaseにアクセス**
   - URL: https://supabase.com
   - 右上の「Start your project」をクリック

2. **アカウント作成**
   - 「Sign in with GitHub」を選択（推奨）
   - または「Sign up with email」でメールアドレスで登録

3. **新規プロジェクト作成**
   - ログイン後、「New Project」ボタンをクリック
   - 以下を入力:
     ```
     Name: feel-hub-dev
     Database Password: （強力なパスワードを生成）
     Region: Northeast Asia (Tokyo) ap-northeast-1
     Pricing Plan: Free
     ```
   - ⚠️ **Database Passwordを必ずメモ！**（後で必要）
   - 「Create new project」をクリック
   - ⏳ プロジェクト作成完了まで2-3分待つ

### Step 2: データベーススキーマの適用

1. **SQL Editorを開く**
   - 左サイドバーから「SQL Editor」をクリック
   - または「Database」→「SQL Editor」

2. **スキーマを実行**
   - 「New query」をクリック
   - 以下のファイルの内容をコピー: `supabase/schema.sql`
   - エディタに貼り付け
   - 右下の「Run」ボタンをクリック
   - ✅ 「Success. No rows returned」と表示されればOK

3. **テーブル確認**
   - 左サイドバーから「Table Editor」をクリック
   - 以下のテーブルが作成されていることを確認:
     - `feelcycle_credentials`
     - `lessons`
     - `waitlist`
     - `attendance_history`
     - `membership_plans`

### Step 3: 環境変数の取得

1. **APIキーを取得**
   - 左サイドバーから「Settings」（歯車アイコン）をクリック
   - 「API」タブをクリック

2. **以下の値をコピーして保存**
   ```
   Project URL: https://xxxxxxxxxxxxx.supabase.co
   anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
   service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
   ```

   - ⚠️ `service_role key`は「Reveal」をクリックして表示
   - ⚠️ `service_role key`は**絶対に公開しない**（管理者権限）

3. **メモ帳に保存**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Step 4: 認証設定（オプション）

1. **Email認証を有効化**
   - 左サイドバーから「Authentication」をクリック
   - 「Providers」タブをクリック
   - 「Email」が有効になっていることを確認（デフォルトで有効）

2. **確認メール設定（後で変更可能）**
   - 「Email Templates」で確認メールのテンプレートをカスタマイズ可能
   - デフォルトのままでもOK

---

## Vercelデプロイ

### Step 1: Vercelアカウント作成

1. **Vercelにアクセス**
   - URL: https://vercel.com
   - 右上の「Sign Up」をクリック

2. **GitHubで認証**
   - 「Continue with GitHub」をクリック
   - GitHubの認証画面で「Authorize Vercel」をクリック

3. **プランを選択**
   - 「Hobby」プラン（無料）を選択
   - 個人情報を入力して「Continue」

### Step 2: GitHubリポジトリのインポート

1. **新規プロジェクト作成**
   - ダッシュボードで「Add New...」→「Project」をクリック

2. **リポジトリを選択**
   - 「Import Git Repository」セクションで
   - `feel-hub` リポジトリを探す
   - 見つからない場合は「Adjust GitHub App Permissions」をクリック
   - リポジトリへのアクセス権限を付与

3. **リポジトリをインポート**
   - `feel-hub` の横にある「Import」ボタンをクリック

### Step 3: プロジェクト設定

1. **ブランチを選択**
   - 「Configure Project」画面で
   - 「Git Branch」を `claude/feelcycle-hub-setup-011CUnpzBZRzUiz5reJ3jwz6` に変更
   - またはデフォルトの `main` ブランチを使用する場合は、先にGitHubでマージ

2. **Framework Preset**
   - 自動で「Next.js」が選択されていることを確認

3. **Root Directory**
   - デフォルトの `.` のままでOK

### Step 4: 環境変数の設定

1. **Environment Variablesセクションを展開**
   - 「Environment Variables」をクリック

2. **以下の環境変数を追加**

   **必須の変数（Supabaseから取得）:**
   ```
   Name: NEXT_PUBLIC_SUPABASE_URL
   Value: https://xxxxxxxxxxxxx.supabase.co

   Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

   Name: SUPABASE_SERVICE_ROLE_KEY
   Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

   **暗号化キー（ランダム文字列）:**
   ```
   Name: ENCRYPTION_KEY
   Value: （32文字以上のランダム文字列）
   ```

   暗号化キーの生成方法:
   - ブラウザのコンソールで: `btoa(Math.random().toString()).substring(0,32)`
   - またはオンラインツール: https://www.random.org/strings/
   - 例: `4f8a9b2e7c1d6e3a8b5c9f2d7e4a1b8c`

3. **各変数を追加**
   - Name欄に変数名を入力
   - Value欄に値を入力
   - 「Add」ボタンをクリック
   - 全ての変数を追加するまで繰り返す

### Step 5: デプロイ開始

1. **デプロイ実行**
   - すべての設定が完了したら
   - 「Deploy」ボタンをクリック
   - ⏳ ビルド＆デプロイ完了まで3-5分待つ

2. **デプロイ完了**
   - 🎉 おめでとうございます！
   - デプロイが完了すると以下が表示されます:
     ```
     https://feel-hub-xxxxx.vercel.app
     ```
   - このURLをコピーしてブラウザで開く

---

## 動作確認

### Step 1: 基本動作確認

1. **トップページにアクセス**
   - デプロイされたURL: `https://feel-hub-xxxxx.vercel.app`
   - 「Feel Hub」のトップページが表示されることを確認

2. **各ページの確認**
   - 「ログイン」ボタンをクリック → ログインページが表示
   - 「レッスン一覧を見る」をクリック → レッスンページが表示
   - トップに戻る

### Step 2: Supabase接続確認

1. **ブラウザの開発者ツールを開く**
   - Windows/Linux: `F12` または `Ctrl + Shift + I`
   - Mac: `Cmd + Option + I`

2. **Consoleタブを確認**
   - エラーが出ていないことを確認
   - Supabase接続エラーがないかチェック

### Step 3: 環境変数の確認

Vercelダッシュボードで確認:
1. プロジェクトを選択
2. 「Settings」タブ
3. 「Environment Variables」
4. すべての変数が正しく設定されていることを確認

---

## トラブルシューティング

### ❌ ビルドエラーが発生した場合

**エラー例:** `Module not found: Can't resolve '@supabase/ssr'`

**解決方法:**
1. Vercelダッシュボードで「Deployments」タブを開く
2. 失敗したデプロイをクリック
3. エラーログを確認
4. GitHubで最新のコードがプッシュされているか確認
5. 「Redeploy」ボタンで再デプロイ

### ❌ 環境変数が反映されない

**解決方法:**
1. Vercelダッシュボードで「Settings」→「Environment Variables」
2. 変数の値を再確認
3. 変数を一度削除して再追加
4. 「Deployments」タブで「Redeploy」

### ❌ Supabaseに接続できない

**チェック項目:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL` が正しいか
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` が正しいか
- [ ] Supabaseプロジェクトが稼働しているか（Supabaseダッシュボードで確認）
- [ ] Row Level Securityが有効か（schema.sqlを実行したか）

### ❌ ページが表示されない

**チェック項目:**
- [ ] デプロイが完全に完了しているか
- [ ] Vercelのステータスページで障害が発生していないか
- [ ] ブラウザのキャッシュをクリア（`Ctrl + Shift + R` または `Cmd + Shift + R`）

### 📞 サポートが必要な場合

エラーメッセージをコピーして私に共有してください:
- Vercelのビルドログ
- ブラウザのコンソールエラー
- Supabaseのエラーメッセージ

---

## 次のステップ

デプロイが完了したら:

### ✅ Phase 1 完了！

次はどちらに進みますか？

**A. Phase 2: レッスン情報スクレイピング実装**
- FEELCYCLEサイトからレッスン情報を取得
- データベースに保存
- フロントエンドに表示

**B. AWS Lambda設定（スクレイピング用）**
- AWS CLI設定
- Lambdaデプロイ
- EventBridge設定

---

## 📝 チェックリスト

デプロイ完了前に確認:

- [ ] Supabaseプロジェクト作成完了
- [ ] データベーススキーマ適用完了
- [ ] Supabase APIキー取得完了
- [ ] Vercelアカウント作成完了
- [ ] GitHubリポジトリ連携完了
- [ ] 環境変数設定完了（4つすべて）
- [ ] デプロイ成功
- [ ] Webサイトにアクセス可能
- [ ] エラーが出ていない

すべてチェックできたら **Phase 1 完全クリア！** 🎉

---

**質問やエラーがあれば、いつでも聞いてください！**
