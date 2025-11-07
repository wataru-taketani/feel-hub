# Feel Hub - Supabase Setup

## データベースセットアップ

### 1. Supabaseプロジェクトの作成

1. https://supabase.com にアクセス
2. "New Project" をクリック
3. プロジェクト名: `feel-hub-dev` (開発用) または `feel-hub-prod` (本番用)
4. データベースパスワードを設定（保存しておく）
5. リージョン: `Tokyo (ap-northeast-1)` を選択

### 2. スキーマの適用

1. Supabaseダッシュボードで「SQL Editor」を開く
2. `schema.sql` の内容をコピー&ペースト
3. 「Run」をクリックして実行

### 3. 環境変数の取得

Supabaseダッシュボードの「Settings」→「API」から以下を取得:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. 認証の設定

1. Supabaseダッシュボードで「Authentication」→「Providers」を開く
2. 「Email」プロバイダーを有効化
3. 必要に応じて他のプロバイダー（Google、GitHubなど）も設定可能

## データベーススキーマ

### テーブル一覧

#### 1. `feelcycle_credentials`
- FEELCYCLEの認証情報（暗号化済み）
- LINE Notify トークン

#### 2. `lessons`
- レッスン情報（日時、プログラム、インストラクター、空き状況など）
- スクレイピングで自動更新

#### 3. `waitlist`
- キャンセル待ちリスト
- 自動予約フラグ

#### 4. `attendance_history`
- 受講履歴
- 統計分析用

#### 5. `membership_plans`
- プラン情報（マンスリー8、15、30など）
- 残数計算用

## Row Level Security (RLS)

すべてのテーブルでRLSが有効化されています:

- ユーザーは**自分のデータのみ**アクセス可能
- レッスン情報は**全ユーザーが閲覧可能**
- Lambda関数は**Service Role Key**で全データにアクセス可能

## バックアップ

Supabaseは自動バックアップを提供:

- 無料プラン: 7日間のバックアップ
- Pro プラン: 30日間のバックアップ

手動バックアップ:
1. ダッシュボードで「Database」→「Backups」
2. 「Create Backup」をクリック

## マイグレーション

スキーマを変更する場合:

1. `migrations/` ディレクトリに新しいSQLファイルを作成
2. ファイル名: `YYYYMMDDHHMMSS_description.sql`
3. Supabase CLIでマイグレーション実行（または手動でSQL Editorで実行）

```bash
# Supabase CLIのインストール（オプション）
npm install -g supabase

# マイグレーション実行
supabase db push
```

## トラブルシューティング

### 接続エラー

- 環境変数が正しく設定されているか確認
- SupabaseダッシュボードでAPIキーを再確認

### RLSエラー

- ユーザーが正しく認証されているか確認
- RLSポリシーが正しく設定されているか確認

### パフォーマンス

- インデックスが適切に設定されているか確認
- クエリのパフォーマンスを「Database」→「Query Performance」で確認
