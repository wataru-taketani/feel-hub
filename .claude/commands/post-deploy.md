# デプロイ後チェック

コード変更・デプロイ後に以下を自動実行する。

## 1. MEMORY.md 更新チェック
- 今回の変更で新しく判明した事実（API仕様、バグの原因、アーキテクチャ変更等）があれば `/Users/wataru/.claude/projects/-Users-wataru-Projects-feel-hub/memory/MEMORY.md` を更新
- 既存の記述と重複しないこと。既存エントリの修正・追記で対応

## 2. CLAUDE.md TODO 更新
- 完了したTODOがあれば `/Users/wataru/Projects/feel-hub/CLAUDE.md` の「積み残し / TODO」セクションからチェック済みにする or 削除
- 新しいTODOが発生した場合は追記

## 3. Lambda 変更時: CloudWatch ログ確認
- Lambda コードを変更・デプロイした場合のみ実行
- `aws logs tail /aws/lambda/feel-hub-lambda-prod-checkCancellation --since 3m --format short` で直近のログを確認
- エラーがないこと、期待通りの動作をしていることを確認してユーザーに報告

## 4. Vercel 変更時: デプロイ確認
- フロントエンドの変更があった場合、git push 後に Vercel デプロイが正常完了したことを確認

## 実行条件
- コード変更を伴うタスクの完了時に毎回実行する
- 「提案のみ」のタスクでは実行しない
