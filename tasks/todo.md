# 表示速度改善タスク

## Wave 1（完了）
- [x] **A1**: `/api/programs` キャッシュ追加 → 既に実装済みだった
- [x] **A5**: `select('*')` → 必要カラム指定（history API + waitlist JOIN）
- [x] **A3**: プリセットのlocalStorage即時復元（lessons fetchの前倒し）

## Wave 2（完了）
- [x] **A2**: レッスン一覧から `/api/dashboard` 除去 + 軽量 `/api/reservations` 新設
- [x] **A7**: attendance_history 集計のDB側 GROUP BY 移行（RPC: `get_program_counts`）

## 有料施策（将来検討）
- **B1**: Vercel Pro ($20/月) — Edge Functions + ISR強化 + Analytics。ボトルネック可視化に有用
- **B2**: Supabase Pro ($25/月) — PgBouncer接続プーリング + pause停止解消 + 8GB RAM
- **B3**: Upstash Redis ($0〜10/月) — FC API応答をTTL 5分キャッシュ。dashboard 3秒→200ms
- **B4**: Lambda Provisioned Concurrency ($15〜/月) — コールドスタート排除
- **B5**: CloudFront CDN ($0〜5/月) — API応答のEdgeキャッシュ

## 大規模改修（将来検討）
- **C1**: Server Components化 — 全ページCSR→SSR移行、JS bundle削減
- **C2**: FCセッション共有 — Lambda/API Routes間でセッションCookie共有
- **C4**: 予約情報のDB同期 — FC API依存をバックグラウンド同期に移行
- **A8**: CalendarView仮想化 — 画面内±数日のみDOM描画
