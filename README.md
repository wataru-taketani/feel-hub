# Feel Hub

FEELCYCLEライフをもっと快適にするWebサービス

## 概要

Feel HubはFEELCYCLE（https://www.feelcycle.com/）の利用をサポートする非公式ツールです。
人気レッスンのキャンセル待ち通知、自動予約、受講履歴分析などの機能を提供します。

## 主な機能（開発予定）

### Phase 1: Webサービスの基盤構築 ✅
- [x] Next.js + TypeScript + Tailwind CSSのセットアップ
- [x] 基本的なUI（トップページ、ログイン画面）
- [x] プロジェクト構造の構築

### Phase 2: レッスン情報取得
- [ ] FEELCYCLEサイトのスクレイピング機能
- [ ] レッスンデータのDB保存
- [ ] レッスン一覧表示

### Phase 3: キャンセル待ち機能
- [ ] キャンセル待ちリスト登録UI
- [ ] 定期スクレイピング（AWS Lambda + EventBridge）
- [ ] 空き枠検知とLINE通知

### Phase 4: 公式サイトログイン連携
- [ ] FEELCYCLE認証情報の暗号化保存
- [ ] マイページ情報取得
- [ ] 自動予約機能
- [ ] 受講履歴分析

## 技術スタック

### フロントエンド
- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Vercel** でホスティング

### バックエンド
- **Vercel API Routes** (軽量API)
- **AWS Lambda** (スクレイピング・重い処理)
- **AWS EventBridge** (定期実行)

### データベース・認証
- **Supabase** (PostgreSQL + 認証)

### その他
- **Cheerio / Puppeteer** (スクレイピング)
- **crypto-js** (FEELCYCLE認証情報の暗号化)
- **LINE Messaging API** (通知)

## セットアップ

### 前提条件
- Node.js 20以上
- npm または yarn
- Supabaseアカウント（無料）
- AWSアカウント（Phase 2以降）

### 環境変数の設定

`.env.example`をコピーして`.env.local`を作成:

```bash
cp .env.example .env.local
```

以下の環境変数を設定:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Encryption
ENCRYPTION_KEY=your_random_32_character_string

# LINE (Phase 3以降)
LINE_NOTIFY_TOKEN=your_line_notify_token
```

### インストールと起動

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm start
```

開発サーバーは http://localhost:3000 で起動します。

## Vercelへのデプロイ

1. GitHubリポジトリと連携
2. Vercelプロジェクト作成
3. 環境変数を設定
4. `main`ブランチにpushすると自動デプロイ

詳細は[Vercel公式ドキュメント](https://vercel.com/docs)を参照。

## プロジェクト構造

```
feel-hub/
├── app/                   # Next.js App Router
│   ├── login/            # ログインページ
│   ├── lessons/          # レッスン一覧ページ
│   ├── layout.tsx        # ルートレイアウト
│   └── page.tsx          # トップページ
├── components/           # 再利用可能なコンポーネント
├── lib/                  # ライブラリ設定（Supabaseなど）
├── types/                # TypeScript型定義
├── utils/                # ユーティリティ関数（暗号化など）
├── .env.example          # 環境変数テンプレート
└── README.md
```

## ライセンス

個人利用目的のプロジェクトです。

## 免責事項

このツールはFEELCYCLEの非公式ツールであり、FEELCYCLE公式とは一切関係ありません。
利用は自己責任でお願いします。
