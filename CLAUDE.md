# Feel Hub - Claude Code 開発ガイド

## プロジェクト概要
FEELCYCLEレッスン情報管理アプリ。レッスン検索、予約状況確認、キャンセル待ち通知をLINE経由で提供。

## 開発ルール（最重要）

### 変更規模の分類と対応プロセス

すべての変更は着手前に規模を判定し、規模に応じたプロセスを踏むこと。

| 規模 | 基準 | 必須プロセス |
|------|------|-------------|
| **S** | 1-2ファイル、既存パターンの踏襲、**DB操作の新規追加を含まない** | ビルド → デプロイ → 本番検証 |
| **M** | 3-5ファイル、または新規テーブル/カラム追加、**またはDB操作の新規追加** | **コーディング前チェック** → ビルド → デプロイ → 本番検証 |
| **L** | 6ファイル以上、アーキテクチャ変更、新規API群 | **Plan mode必須**（※） → コーディング前チェック → ファイルごとの差分レビュー → ビルド → デプロイ → 本番検証 |

※ **L規模Plan modeに含めるべき項目**: 変更対象ファイル一覧、操作するテーブルとカラムのマトリクス、デプロイ順序（DB→コード or コード→DB）、ロールバック手順、検証計画

**規模判定ルール**: DB操作を新規追加する変更は、ファイル数に関わらず最低M。迷ったら上の規模を選ぶ。M/L規模をSとして扱うと、サイレント障害（PostgRESTの空結果等）を見逃す。

### 本番環境が正
- **本番環境（Vercel / Lambda）を唯一の検証環境とする**。ローカル動作確認は不要
- ユーザーはスマホで本番サイトを直接確認する
- **ただし「本番デプロイ = 品質保証」ではない**。デプロイ後の検証で初めて品質が確認される

### コーディング前チェック（M規模以上は必須、S規模でもDB操作時は実施）
DB操作（Supabaseクエリ）を新規追加・変更する場合、コーディング前に以下を実行すること：
1. **対象テーブルのカラム名を確認**: Supabase execute_sql で `SELECT column_name FROM information_schema.columns WHERE table_name = '<table>'` を実行し、実カラム名を取得。**結果をユーザーに提示する**
2. **user識別カラムの確認**: `user_profiles` は `id`、他テーブルは `user_id`（`tasks/lessons.md` の一覧参照）
3. **既存コードの参照パターン確認**: 同じテーブルを操作する既存APIのコードを grep で探し、カラム名・クエリパターンを合わせる
4. **変更対象ファイル一覧を列挙**: M規模以上では、着手前に変更予定ファイル一覧をユーザーに提示する

### コミット＆デプロイフロー
コード変更後は以下を必ず順に実行すること：
1. `npm run build` — ビルドエラーがないことを確認
2. Supabaseマイグレーションがある場合: **コードデプロイの前に** `npx supabase db push`（新カラム追加→コードデプロイの順が安全。逆だと新コードが古いスキーマで動く）
3. `git add <変更ファイル>` + `git commit` — 変更をコミット
4. `git push origin main` — Vercel 自動デプロイをトリガー
5. **本番検証（次セクション参照）** — 検証完了してからユーザーに報告する
- **「修正しました」とだけ言ってデプロイしないのは禁止**
- **ビルド成功だけで「完了」と言うのも禁止** — DBスキーマ不整合はビルドで検出できない
- Lambda 変更がある場合: `cd lambda && npx tsc && npx serverless deploy --stage prod`
- **新テーブル追加時**: `tasks/lessons.md` のテーブル別カラム名一覧を必ず更新する

### デプロイ後検証（省略不可）
コード変更を伴うタスク完了時に、**指示がなくても**以下を必ず実行すること。
完了報告には **検証結果のエビデンス（SQLの実行結果、ログ出力等）を含める**こと。

#### 品質検証（必須）
1. **API/DB変更時 — 本番データ検証**: 変更したAPI/クエリが正しいデータを返すことを確認
   - Supabase execute_sql で `SELECT count(*) FROM <table> WHERE <condition>` を実行
   - 新規テーブル・カラム追加時は、データが正しく書き込まれていることを確認
   - **0件の場合は障害の可能性**。「問題ありません」で済ませず原因を調査する
2. **Lambda変更時**: `aws logs tail` で直近ログを確認し、エラーがないことを検証
3. **Vercel変更時**: デプロイ正常完了を確認

#### メタ更新（品質検証の後）
4. **MEMORY.md 更新**: 新しく判明した事実があれば更新
5. **CLAUDE.md TODO 更新**: 完了したTODOはチェック済み/削除、新規TODOは追記

### 本番DBへのデータ操作ルール
1. **テストデータの投入禁止**: 本番DBにテストデータを入れない。やむを得ず入れる場合は `_test` サフィックス等で明確に識別可能にし、**同一セッション内で必ず削除する**
2. **削除操作は事前確認必須**: 本番データの削除は、対象レコードの内容と件数をユーザーに提示し、承認を得てから実行する
3. **一括調査してから一括対処**: テストデータ等の調査は全テーブルを一括で調べ、全体像を把握してから対処する。1件ずつ五月雨に対応しない

### 障害対応フロー
障害（本番でデータが見えない、表示がおかしい等）が発生した場合：
0. **全ユーザーに影響する重大障害の場合**: まず `git revert` + push でロールバックし、影響を止めてから調査に入る。revert は暫定対応ではなく緊急措置として許容する
1. **全体調査を先に行う**: 影響範囲を特定する。1箇所の修正で終わらせず、同じパターンの問題が他にないか全件検索する
2. **根本原因を特定する**: 表面的な症状（「データが空」）ではなく、なぜそうなったか（「カラム名が違う」）まで掘り下げる
3. **一括修正**: 同じ原因の問題をすべて洗い出してから、まとめて修正する
4. **再発防止を構造化**: `tasks/lessons.md` に教訓を記録し、CLAUDE.md のプロセスに反映する。メモ追加だけで終わらせない — **プロセス自体を変更する**

### 実装前の要件確認（全規模で必須）
コーディングを始める前に、以下を自問し、不明点があればユーザーに確認すること：
1. **ユーザーが求めている体験は何か**: 「何を実装するか」ではなく「ユーザーが画面で何を見て、どう操作するか」を具体的にイメージする
2. **自分の解釈を言語化する**: 要件を自分の言葉で言い換え、ユーザーに提示してから実装に入る。「たぶんこういうことだろう」で進めない
3. **仮定を洗い出す**: 「このユーザーはFC連携済みだろう」「この値はDBに入っているだろう」等の仮定を明示し、DBクエリ等で事実確認する
4. **1回のデプロイで完結する設計か**: 実装→ユーザー指摘→再実装→再デプロイの反復はリソースの浪費。最初から正しいものを出す

### チームレビューの品質基準
subagentによるレビューは以下の**全観点**を含めること。コード正確性だけでは不十分：
1. **要件一致**: ユーザーの指示と実装が一致しているか。指示の「意図」まで汲み取れているか
2. **UX妥当性**: ユーザーが実際に操作したとき、混乱や不満が生じないか
3. **コード正確性**: バグ、エッジケース、型エラーがないか
4. **デプロイ効率**: この変更は1回のpushで完結するか。関連するドキュメント変更も含まれているか

### 1タスク1デプロイの原則
- **1つのタスクに対して、pushは原則1回**。コード変更とドキュメント変更（CLAUDE.md, lessons.md等）は同一コミットにまとめる
- 「とりあえずデプロイして確認」は禁止。ローカルビルド + チームレビューで確信を持ってからpush
- ユーザーに指摘されて再デプロイが必要になった場合、それは**レビュー品質の失敗**として `tasks/lessons.md` に記録する
- **Vercel無料枠（4h CPU/月）**: 1回のビルドで約5-10分消費。月40回程度が上限。無駄なデプロイは枠の浪費

### 変更方針
- 必要最小限の変更のみ。勝手に余計な改修・リファクタをしない
- 中間画面を増やすより直接遷移
- DB調査は一括で行う。五月雨にcurlを打って毎回承認を求めない → subagentに委譲
- **「提案して」と言われたら提案のみ。勝手に実装まで進めない**
- **ユーザーの指摘の意図を深く考える**。表面的な対応ではなく根本の課題を理解する
- **暫定対応は禁止**: 問題を見つけたら根本原因まで調査し、構造的に解決する

### モバイルUI原則
- **モバイルファースト**: 375px（iPhone SE）を基準に設計
- `hover:` はモバイルで残留するため原則 `active:` を使う
- タッチターゲットは最低 32px（理想 44px）
- **アイコンだけのボタンは禁止**: 必ずテキストラベルを併記する。アイコンだけでは何のボタンかわからない
- モーダルは `max-h-[85vh] overflow-y-auto` で縦溢れ防止
- モーダル内にアクションボタンがある場合は**stickyフッターに配置**（コンテンツが長いと隠れるため）
- 選択モーダル（スタジオ・IR等）には必ず**「決定」ボタン**を設置。×や枠外タップだけでは不親切
- `opacity`でテキストを薄くするのはNG。グレーアウトは`bg-muted`で背景を変え、テキストは読める濃さを維持（WCAG AA基準）
- エラー表示は統一パターン: `text-destructive bg-destructive/10 rounded-lg border border-destructive/50`

### レイアウト設計原則
- **要素の配置場所を意識する**: 同じ行にボタンとチップを混在させるとスペースを食い合う。用途が違うものは行を分ける
- フィルタチップ等の可変長コンテンツはフル幅の専用行に配置し、ツールバーボタンとは分離する
- 横スクロールで要素を隠すのはNG（可視性が下がる）。折り返し表示でスペースを確保する

## iOS Safari 固有の注意事項
- `scroll-snap-type: x mandatory` と `scrollTo({ behavior: 'smooth' })` は**併用不可**。scrollTo がsnap に阻害されて動かない
- 対策: `requestAnimationFrame` で `scrollLeft` を直接操作する手動アニメーション。snap無効化 → 強制reflow(`void container.offsetHeight`) → アニメーション → snap復元
- input/textareaの`font-size`は16px以上（`text-base`）でないとiOSが自動ズームする

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
    history/            # 受講履歴
    groups/             # グループ機能
  lessons/              # レッスン一覧ページ
  login/                # ログインページ (LINE Login のみ)
  mypage/               # マイページ
  history/              # 受講履歴
  groups/               # グループ詳細ページ
components/             # UIコンポーネント
  lessons/              # レッスン関連コンポーネント
  history/              # 受講履歴関連コンポーネント
  mypage/               # マイページ関連コンポーネント
  ui/                   # shadcn/ui コンポーネント
hooks/                  # カスタムフック (useWaitlist, useBookmarks, useFilterPresets等)
lib/                    # ユーティリティ
  feelcycle-api.ts      # FEELCYCLE API クライアント
  crypto.ts             # 暗号化 (AES-256-GCM)
  lessonUtils.ts        # レッスン関連ユーティリティ（スタジオ情報等）
  supabase/             # Supabase クライアント
lambda/                 # AWS Lambda 関数
  scraper/              # スクレイピング + キャンセル待ちチェック
contexts/               # React Context (AuthContext)
types/                  # TypeScript 型定義
supabase/migrations/    # DBマイグレーション
```

## 主要コンポーネント関係

### レッスン一覧ページ (`app/lessons/page.tsx`)
- `CalendarView` — カレンダー表示。スロット: `toolbarLeft`（ブックマーク）、`toolbarRight`（リセット+絞り込み+ナビ）、`middleContent`（FilterBar）
- `FilterBar` — フィルタパネル。`hideToolbar=true`時はチップ行+折り畳みパネルのみ表示（ボタン類は親がtoolbarRightに配置）
- `CalendarDateColumn` — 日付列。`memo`化済み
- `LessonCard` — レッスンカード。`memo`化済み
- `LessonDetailModal` — レッスン詳細モーダル（予約/キャンセル待ち/バイクマップ）
- `StudioMultiSelect` / `InstructorMultiSelect` — 選択モーダル（決定ボタン付き）

### 受講履歴ページ (`app/history/page.tsx`)
- `HistoryAnalytics` — 分析タブ
- `ProgramCompletion` — 実績タブ
- `ProgramAnalyticsModal` — プログラムタップ時のモーダル（stickyフッターに「レッスンを探す」ボタン）

## パフォーマンス最適化（実施済み）
- Dashboard: profile/groups/dashboard fetchをPromise.allで並列化
- Dashboard API: 予約エンリッチのN+1クエリをバッチクエリ化（Mapルックアップ）
- attendance_history: `(user_id, cancel_flg, shift_date)` 複合インデックス
- LessonCard/CalendarDateColumn: `React.memo`化
- Studios API: `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`
- Lessons API: `select('*')` → 必要カラムのみ
- **FC同期アーキテクチャ**: 全ページDB-firstレンダリング + バックグラウンドFC API同期（10分TTL）
- 全ページにLoader2スピナー追加（スケルトン + くるくる）

## 開発コマンド
```bash
npm run build            # ビルド確認（必須）
git push origin main     # Vercel自動デプロイ
npx supabase db push     # マイグレーション適用

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
- `useSearchParams()` は `<Suspense>` 境界が必要（Next.js 15）
- URL param でフィルタを受け取る場合、保存済みプリセットを上書きする（+ではなく置換）

## Lambda エラーハンドリング設計原則（2026-03-08 確立）
- **Supabase `.single()` は error も必ずチェック**: PGRST116="Row not found" のみ「該当なし」、それ以外は一時DB障害として `conflict`（リトライ）
- **LINE通知後は `waitlist.notified=true`**: 通知済みなのに notified=false だと10分ごとにスパム送信される
- **SESSION_EXPIRED は一時エラー**: Lambda は毎回新規ログインするため、API中の401/302/403はFC API一時障害。`conflict` で静かにリトライ
- **エラー分類**: `FcAuthError`=恒久（auth_valid=false）、通常Error=一時（conflict でリトライ）。一時エラーで永久停止フラグを立てない
- **autoReserveLesson の戻り値と waitlist 処理**:
  - `success`, `needs_confirm`, `error`, `auth_failed` → `notified=true`（完了 or 通知済み）
  - `auth_invalid` → そのまま（FC再連携で auth_valid=true になれば自動再開）
  - `conflict` → そのまま（次サイクルで自動リトライ）

## キャンセル待ち・自動予約の締切時刻ルール（実装済み 2026-03-09）
- **キャンセル待ち通知（auto_reserve=false）**: レッスン開始 **2時間前** まで
- **自動予約（auto_reserve=true）**: レッスン開始 **3時間前** まで（2-3h間はchangeSeatのみ許可）
- **自動振替（rc=1→changeSeat）**: レッスン開始 **2時間前** まで
- `lambda/serverless.yml` に `TZ: Asia/Tokyo` 設定済み

## 積み残し / TODO
- [x] `LessonDetailModal.tsx`: `lesson.isFull` 条件 — 確認済み、正しく設定されている
- [x] Phase 5-3 Step 2: rc=303 の自動処理 — Lambda/フロント両方で 1042/1143/1024 自動完了済み。10242（チケット購入）は自動化不可で手動案内
- [x] 自動振替: 予約済みレッスンの席変更対応（`POST /api/reservation/sheet/change`）— 実機テスト済み
- [ ] レッスン詳細モーダルにプログラム受講回数を表示（GROUP BY programで一括取得→キャッシュ方式）
- [ ] LINE通知からキャンセル待ち再登録（Flex Message + postback or ワンタイムURL）
- [x] レッスン一覧の絞り込みに「未受講」フィルタを追加（受講履歴にないプログラムで絞り込み）
- [x] キャンセル待ち・自動予約の締切時刻制限（通知=2h前、自動予約=3h前、自動振替=2h前）
