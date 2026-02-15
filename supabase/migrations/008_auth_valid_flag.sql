-- 認証情報の有効性フラグ
-- パスワード変更等でログイン失敗した場合にfalseにセットし、
-- 以降のバックグラウンドログイン試行を停止してアカウントロックを防止
ALTER TABLE feelcycle_credentials
  ADD COLUMN IF NOT EXISTS auth_valid BOOLEAN DEFAULT true;
