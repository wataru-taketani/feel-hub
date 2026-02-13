-- Migration: lessonsテーブルにAPI全フィールド用カラム追加
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS store_id text;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS sid_hash text;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS lesson_period integer;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS lesson_status integer;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS mess_flg integer;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS reserve_status integer;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS text_color text;
