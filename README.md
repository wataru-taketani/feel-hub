# FEELhub

FEELCYCLEライフをもっと快適にするWebサービス

## 概要

FEELhubはFEELCYCLE（https://www.feelcycle.com/ ）の利用をサポートする非公式ツールです。
レッスン検索、予約状況確認、キャンセル待ち通知、自動予約などの機能をLINE経由で提供します。

**本番URL**: https://feel-hub.vercel.app

## アーキテクチャ

```
[ユーザー] ── LINE Login ──> [Vercel (Next.js 15)]
                                     │
                                [Supabase DB]
                                     │
[AWS Lambda] ── 10分間隔スクレイピング ──┘
      │
      ├── キャンセル検知（5分間隔）
      ├── 自動予約（FEELCYCLE API）
      └── LINE通知（Messaging API）
```

## 実装済み機能

### Phase 1-2: レッスン情報取得・表示
- FEELCYCLE内部APIから全スタジオのレッスンを自動取得（Lambda + EventBridge 10分毎）
- レッスン一覧カレンダーUI（スタジオ別・プログラム検索・インストラクター・チケット種別フィルタ）
- 固定枠（予約済み・ブックマーク）の折り畳み + 横スクロール同期

### Phase 3: キャンセル待ち・LINE通知
- 空き通知（waitlist）登録UI + レッスン詳細モーダル
- キャンセル検知Lambda（5分間隔・DB値参照で空き判定）
- LINE Messaging APIプッシュ通知

### Phase 4: 公式サイトログイン連携
- LINE Login OAuth連携（主認証方式）
- FEELCYCLE認証情報の暗号化保存（AES-256-GCM）
- マイページ情報取得（予約・チケット・会員情報）
- 受講履歴の同期・月別表示・分析ダッシュボード
- ダッシュボード（予約一覧・サブスク残・チケット期限・キャンセル待ち状況）

### Phase 5: 自動予約（Step 1 完了）
- キャンセル待ちレッスンの空き検知時に自動予約
- FC認証情報を復号 → ログイン → 座席マップ取得 → 空席選択 → 予約実行
- result_code判定: 0=成功, 303=要確認（自動完了可能なものは自動処理）, 205=競合（リトライ）
- 結果に応じたLINE通知（成功/要確認/失敗）

## ページ構成

| パス | 内容 | 認証 |
|------|------|------|
| `/` | ダッシュボード（予約一覧・ウェイトリスト・チケット情報）/ 未ログイン時はランディング | 任意 |
| `/login` | LINE Loginログイン画面 | 不要 |
| `/lessons` | カレンダー形式レッスン一覧（フィルタ・ブックマーク・詳細モーダル・座席マップ） | 不要 |
| `/mypage` | FEELCYCLE連携・会員情報・予約管理・履歴同期 | 必須 |
| `/history` | 受講履歴（月別表示・分析ダッシュボード） | 必須 |

## API Routes

### 認証
| エンドポイント | メソッド | 内容 |
|---------------|---------|------|
| `/api/auth/line` | GET | LINE OAuth開始 |
| `/api/auth/line/callback` | GET | LINEコールバック、ユーザー作成/ログイン |
| `/api/auth/feelcycle-link` | POST | FEELCYCLEアカウント連携（暗号化保存） |
| `/api/auth/feelcycle-reauth` | POST | FEELCYCLEセッション自動再認証 |
| `/api/auth/logout` | POST | ログアウト |

### データ取得
| エンドポイント | メソッド | 内容 |
|---------------|---------|------|
| `/api/lessons` | GET | レッスン一覧（スタジオフィルタ対応） |
| `/api/dashboard` | GET | ダッシュボード（予約・会員情報・チケット） |
| `/api/mypage` | GET | マイページデータ |
| `/api/profile` | GET/PATCH | ユーザープロフィール |
| `/api/programs` | GET | プログラムカラーコード（1hキャッシュ） |
| `/api/history` | GET | 受講履歴（月別） |
| `/api/history/sync` | POST | FEELCYCLE→DB履歴同期 |
| `/api/history/stats` | GET | 受講統計 |

### 操作
| エンドポイント | メソッド | 内容 |
|---------------|---------|------|
| `/api/reserve` | POST | レッスン予約（FEELCYCLE API経由） |
| `/api/seatmap` | GET | 座席マップ取得 |
| `/api/waitlist` | GET/POST | キャンセル待ち一覧/登録 |
| `/api/waitlist/[id]` | DELETE/PATCH | キャンセル待ち削除/再登録 |
| `/api/bookmarks` | GET/POST/DELETE | ブックマーク管理 |

## Lambda関数

`lambda/scraper/` 配下。CloudWatch Eventsでスケジュール実行。

| ファイル | 実行間隔 | 内容 |
|---------|---------|------|
| `index.ts` | 10分 | 全スタジオレッスンスクレイピング（shujiku_id 1-50、10並列） |
| `checkCancellation.ts` | 5分 | キャンセル検知（DB値で空き判定→LINE通知 or 自動予約） |
| `autoReserve.ts` | - | 自動予約（checkCancellationから呼出） |
| `fcClient.ts` | - | FEELCYCLE認証・予約APIクライアント |

## DBテーブル

| テーブル | 内容 | 主キー/ユニークキー |
|---------|------|-------------------|
| `lessons` | レッスンデータ | `sid_hash` (upsert用) |
| `user_profiles` | ユーザー情報 | `id` (= auth.users.id), `line_user_id` (unique) |
| `feelcycle_credentials` | FC認証情報（暗号化） | `user_id` |
| `feelcycle_sessions` | FCセッション（暗号化） | `user_id` |
| `waitlist` | キャンセル待ち | `(user_id, lesson_id)` unique |
| `attendance_history` | 受講履歴 | `(user_id, shift_date, start_time, store_name, instructor_name)` unique |
| `bookmarks` | ブックマーク | `(user_id, lesson_key)` unique |
| `filter_presets` | フィルタプリセット | `id`, filters (JSONB) |
| `programs` | プログラムマスタ | `program_name` |

## 認証フロー

```
ユーザー → /login → LINE認可画面
  → /api/auth/line/callback
  → LINE id_token検証 → line_user_id (sub) 取得
  → Supabase Authユーザー作成/ログイン（ダミーemail方式）
  → user_profiles に line_user_id 保存
  → / にリダイレクト
```

FEELCYCLE連携（マイページから）:
```
メール + パスワード入力
  → /api/auth/feelcycle-link
  → AES-256-GCM暗号化 → feelcycle_credentials に保存
  → FEELCYCLEログイン → セッション暗号化保存
```

## LINE連携

| チャネル | ID | 用途 |
|---------|-----|------|
| LINE Login | 2007687052 | ユーザー認証（OAuth） |
| Messaging API | 2007416978 | push通知送信 |

- 両チャネルで同じ `line_user_id`（= OAuth の `sub`）を共有
- 無料枠: 月200通（通数確認: `GET /v2/bot/message/quota/consumption`）
- webhook未実装（push送信のみ）

## プロジェクト構造

```
app/                    # Next.js App Router
  api/                  # API Routes
    auth/               # 認証 (line/, feelcycle-link/, feelcycle-reauth/)
    dashboard/          # ダッシュボードデータ
    lessons/            # レッスン一覧
    bookmarks/          # ブックマーク管理
    seatmap/            # 座席マップ取得
    mypage/             # マイページデータ
    waitlist/           # キャンセル待ち管理
  lessons/              # レッスン一覧ページ
  login/                # ログインページ (LINE Login)
  mypage/               # マイページ
  history/              # 受講履歴
components/             # UIコンポーネント
  lessons/              # レッスン関連 (CalendarView, LessonCard, LessonDetailModal, SeatMap)
  ui/                   # shadcn/ui コンポーネント
hooks/                  # カスタムフック (useWaitlist, useBookmarks)
lib/                    # ユーティリティ
  feelcycle-api.ts      # FEELCYCLE API クライアント
  crypto.ts             # 暗号化 (AES-256-GCM)
  supabase/             # Supabase クライアント
lambda/                 # AWS Lambda
  scraper/              # スクレイピング + キャンセル検知 + 自動予約
contexts/               # React Context (AuthContext)
types/                  # TypeScript型定義
supabase/migrations/    # DBマイグレーション
```

## 環境変数

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# 暗号化キー（AES-256-GCM、32文字以上）
ENCRYPTION_KEY=

# LINE Login
LINE_LOGIN_CHANNEL_ID=
LINE_LOGIN_CHANNEL_SECRET=

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=
```

Lambda用: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LINE_CHANNEL_ACCESS_TOKEN`, `ENCRYPTION_KEY`

## 開発・デプロイ

```bash
# ビルド確認
npm run build

# Vercelデプロイ（git push で自動）
git push origin main

# Lambdaデプロイ
cd lambda && npx tsc && npx serverless deploy --stage prod
```

本番環境（Vercel + Lambda）を唯一の検証環境とする。

## 設計上の注意点

- **レッスンデータはDB値のみ信頼**: 未認証FEELCYCLE APIは `reserve_status_count=0` を返すことがあるため、キャンセル検知ではAPIを呼ばずDB（スクレイパー由来）のみで判定
- **DB: snake_case / TypeScript: camelCase**: API Routeで変換
- **TIME列の正規化**: DB `HH:MM:SS` / FEELCYCLE API `HH:MM` → `.slice(0,5)` で比較
- **waitlist ↔ user_profiles**: 直接FKなし、分離クエリで取得
- **auth_valid フラグ**: `false` になるとFC自動ログインを停止（ロックアウト防止）

## コスト（月額）

| サービス | プラン | コスト |
|---------|--------|--------|
| Vercel | Hobby（無料） | $0 |
| Supabase | Free（500MB DB） | $0 |
| AWS Lambda | 無料枠内 | $0-3 |
| LINE Messaging API | Free（200通/月） | $0 |

## 残タスク

- `LessonDetailModal.tsx`: テスト用に `lesson.isFull` 条件を一時解除中 → 復元必要
- Phase 5-3 Step 2: rc=303 の自動処理
- LINE通知からのキャンセル待ち再登録（Flex Message or URLリンク方式）

## 免責事項

このツールはFEELCYCLEの非公式ツールであり、FEELCYCLE公式とは一切関係ありません。
利用は自己責任でお願いします。
