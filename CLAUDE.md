# Feel Hub - Claude Code 開発ガイド

## プロジェクト概要
FEELCYCLEレッスン情報管理アプリ。レッスン検索、予約状況確認、キャンセル待ち通知をLINE経由で提供。

## 開発ルール（最重要）

### 本番環境が正
- **本番環境（Vercel / Lambda）を唯一の検証環境とする**。ローカル動作確認は不要
- ユーザーはスマホで本番サイトを直接確認する。ローカルでの動作は保証にならない

### コミット＆デプロイフロー
コード変更後は以下を必ず順に実行すること：
1. `npm run build` — ビルドエラーがないことを確認
2. `git add <変更ファイル>` + `git commit` — 変更をコミット
3. `git push origin main` — Vercel 自動デプロイをトリガー
4. Supabaseマイグレーションがある場合: `npx supabase db push`
5. デプロイ完了を確認してからユーザーに報告する
- **「修正しました」とだけ言ってデプロイしないのは禁止**
- Lambda 変更がある場合: `cd lambda && npx tsc && npx serverless deploy --stage prod`

### 変更方針
- 必要最小限の変更のみ。勝手に余計な改修・リファクタをしない
- 中間画面を増やすより直接遷移
- DB調査は一括で行う。五月雨にcurlを打って毎回承認を求めない → subagentに委譲
- **「提案して」と言われたら提案のみ。勝手に実装まで進めない**
- **ユーザーの指摘の意図を深く考える**。表面的な対応ではなく根本の課題を理解する

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
