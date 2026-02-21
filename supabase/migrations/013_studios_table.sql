-- Studios master table
CREATE TABLE studios (
  store_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  area TEXT,
  prefecture TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed from existing lessons data
INSERT INTO studios (store_id, name, abbreviation)
SELECT DISTINCT ON (store_id) store_id, studio,
  CASE studio
    WHEN '渋谷' THEN 'SBY'
    WHEN '新宿' THEN 'SJK'
    WHEN '池袋' THEN 'IKB'
    WHEN '銀座' THEN 'GNZ'
    WHEN '銀座京橋' THEN 'GKBS'
    WHEN '上野' THEN 'UEN'
    WHEN '汐留' THEN 'SDM'
    WHEN '五反田' THEN 'GTD'
    WHEN '中目黒' THEN 'NMG'
    WHEN '自由が丘' THEN 'JYO'
    WHEN '吉祥寺' THEN 'KCJ'
    WHEN '町田' THEN 'MCD'
    WHEN '横浜' THEN 'YKH'
    WHEN '川崎' THEN 'KWS'
    WHEN '武蔵小杉' THEN 'MKG'
    WHEN '上大岡' THEN 'KOK'
    WHEN '横須賀中央' THEN 'YSC'
    WHEN 'あざみ野' THEN 'AZN'
    WHEN 'あざみ野Pilates' THEN 'AZNP'
    WHEN '多摩センター' THEN 'TMC'
    WHEN '柏' THEN 'KSW'
    WHEN '船橋' THEN 'FNB'
    WHEN '海浜幕張' THEN 'KHM'
    WHEN '越谷' THEN 'KSG'
    WHEN '名古屋' THEN 'NGY'
    WHEN '栄' THEN 'SKE'
    WHEN '岐阜' THEN 'GIF'
    WHEN '大阪京橋' THEN 'OKBS'
    WHEN '心斎橋' THEN 'SSB'
    WHEN '梅田茶屋町' THEN 'UMDC'
    WHEN '三ノ宮' THEN 'SMY'
    WHEN '京都河原町' THEN 'KTK'
    WHEN '札幌' THEN 'SPR'
    WHEN '広島' THEN 'HSM'
    WHEN '福岡天神' THEN 'FTJ'
    WHEN '高松' THEN 'TKM'
    ELSE UPPER(LEFT(studio, 3))
  END
FROM lessons
WHERE store_id IS NOT NULL AND studio IS NOT NULL;

-- Add unique constraint on abbreviation
CREATE UNIQUE INDEX studios_abbreviation_unique ON studios (abbreviation);

-- Seed area and prefecture from STUDIO_REGIONS
UPDATE studios SET area = '北海道・東北', prefecture = '北海道' WHERE name = '札幌';
UPDATE studios SET area = '関東', prefecture = '埼玉県' WHERE name = '越谷';
UPDATE studios SET area = '関東', prefecture = '千葉県' WHERE name IN ('船橋', '海浜幕張', '柏');
UPDATE studios SET area = '関東', prefecture = '東京都' WHERE name IN ('銀座京橋', '銀座', '五反田', '池袋', '自由が丘', '吉祥寺', '町田', '中目黒', '渋谷', '汐留', '新宿', '多摩センター', '上野');
UPDATE studios SET area = '関東', prefecture = '神奈川県' WHERE name IN ('あざみ野', 'あざみ野Pilates', '上大岡', '川崎', '武蔵小杉', '横浜', '横須賀中央');
UPDATE studios SET area = '東海・関西', prefecture = '岐阜県' WHERE name = '岐阜';
UPDATE studios SET area = '東海・関西', prefecture = '愛知県' WHERE name IN ('名古屋', '栄');
UPDATE studios SET area = '東海・関西', prefecture = '京都府' WHERE name = '京都河原町';
UPDATE studios SET area = '東海・関西', prefecture = '大阪府' WHERE name IN ('大阪京橋', '心斎橋', '梅田茶屋町');
UPDATE studios SET area = '東海・関西', prefecture = '兵庫県' WHERE name = '三ノ宮';
UPDATE studios SET area = '中国・四国・九州', prefecture = '広島県' WHERE name = '広島';
UPDATE studios SET area = '中国・四国・九州', prefecture = '香川県' WHERE name = '高松';
UPDATE studios SET area = '中国・四国・九州', prefecture = '福岡県' WHERE name = '福岡天神';
