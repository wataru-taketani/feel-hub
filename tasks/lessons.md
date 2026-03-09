# 教訓・再発防止ログ

## 2026-03-09: user_profiles カラム名 id vs user_id 事故

### 事象
FC同期アーキテクチャ導入で、5ファイルで `user_profiles` テーブルに `.eq('user_id', ...)` と書いたが、
実際のPKカラム名は `id`。PostgRESTはエラーを返さず空結果を返すため、サイレントに失敗。
ダッシュボードの予約が全て非表示になった。

### 根本原因
- テーブルごとのカラム名の違いを確認せず、他テーブルの `user_id` パターンを流用した
- `npm run build` はDBスキーマ整合性を検証しない
- デプロイ後の本番スモークテスト（実際に画面を開く）を省略した

### 再発防止ルール
1. **DB操作コードを書く前に、対象テーブルのカラム名を必ず確認する**
   - `SELECT column_name FROM information_schema.columns WHERE table_name = 'xxx'` で確認
   - 特に `user_profiles` は PK が `id`（`user_id` ではない）
2. **新規APIや既存API大幅変更時、デプロイ後に必ずDB応答を確認する**
   - Supabase execute_sql で `SELECT count(*) FROM <table> WHERE <condition>` を実行
   - レスポンスが空でないことを検証
3. **複数テーブルを扱う変更では、テーブルごとのカラム命名規則を一覧化してからコーディングする**

### テーブル別カラム名一覧（user識別子）
| テーブル | user識別カラム | 備考 |
|---|---|---|
| user_profiles | `id` | PK = auth.users.id |
| feelcycle_credentials | `user_id` | FK |
| user_reservations | `user_id` | FK |
| user_tickets | `user_id` | FK |
| attendance_history | `user_id` | FK |
| waitlist | `user_id` | FK |
| feelcycle_sessions | `user_id` | FK |
