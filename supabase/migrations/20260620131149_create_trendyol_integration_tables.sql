/*
# Trendyol API Entegrasyonu Tabloları

## Summary
Trendyol API'sinden çekilen iade/claim verilerini saklamak ve kullanıcı
API bilgilerini güvenli şekilde tutmak için gerekli tabloları oluşturur.

## New Tables

### `trendyol_credentials`
- `id` (uuid, primary key)
- `user_id` (uuid, not null, references auth.users, unique) - her kullanıcının tek bir credential seti
- `seller_id` (text, not null) - Trendyol Satıcı ID
- `api_key` (text, not null) - Trendyol API Key (şifreli saklanacak)
- `api_secret` (text, not null) - Trendyol API Secret (şifreli saklanacak)
- `status` (text, not null, default 'pending') - 'pending' | 'active' | 'failed'
- `last_sync_at` (timestamptz) - son senkronizasyon zamanı
- `error_message` (text) - son hata mesajı
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `claims`
- `id` (uuid, primary key)
- `user_id` (uuid, not null, references auth.users)
- `claim_id` (bigint, not null) - Trendyol'dan gelen unique claim ID
- `product_name` (text) - ürün adı
- `product_barcode` (text) - ürün barkodu
- `claim_reason` (text) - iade sebebi
- `customer_note` (text) - müşteri notu
- `claim_date` (timestamptz) - iade tarihi
- `quantity` (integer, default 1) - iade miktarı
- `status` (text) - claim durumu
- `raw_data` (jsonb) - ham API verisi
- `created_at` (timestamptz, default now())

### `claim_reasons_summary`
- `id` (uuid, primary key)
- `user_id` (uuid, not null, references auth.users)
- `reason` (text, not null) - iade sebebi
- `count` (integer, not null) - bu sebepten olan iade sayısı
- `percentage` (numeric(5,2)) - toplam içindeki yüzdesi
- `updated_at` (timestamptz, default now())

### `product_claim_stats`
- `id` (uuid, primary key)
- `user_id` (uuid, not null, references auth.users)
- `product_barcode` (text, not null) - ürün barkodu
- `product_name` (text) - ürün adı
- `total_claims` (integer, default 0) - toplam iade sayısı
- `total_quantity` (integer, default 0) - toplam iade miktarı
- `last_claim_date` (timestamptz) - son iade tarihi
- `updated_at` (timestamptz, default now())

## Security
- RLS tüm tablolarda etkin
- Her kullanıcı yalnızca kendi verilerini görebilir/düzenleyebilir

## Notes
1. `trendyol_credentials` tablosunda API key/secret şifreli saklanmalı (uygulama katmanında)
2. `claims` tablosu Trendyol API'sinden çekilen ham verileri saklar
3. `claim_reasons_summary` ve `product_claim_stats` özet tabloları, dashboard'da hızlı erişim için
*/

-- Trendyol Credentials
CREATE TABLE IF NOT EXISTS trendyol_credentials (
  id           uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid       NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id    text       NOT NULL,
  api_key      text       NOT NULL,
  api_secret   text       NOT NULL,
  status       text       NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed', 'disconnected')),
  last_sync_at timestamptz,
  error_message text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trendyol_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_credentials" ON trendyol_credentials;
CREATE POLICY "select_own_credentials" ON trendyol_credentials FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_credentials" ON trendyol_credentials;
CREATE POLICY "insert_own_credentials" ON trendyol_credentials FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_credentials" ON trendyol_credentials;
CREATE POLICY "update_own_credentials" ON trendyol_credentials FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_credentials" ON trendyol_credentials;
CREATE POLICY "delete_own_credentials" ON trendyol_credentials FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Claims
CREATE TABLE IF NOT EXISTS claims (
  id              uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_id        bigint     NOT NULL,
  product_name    text,
  product_barcode text,
  claim_reason    text,
  customer_note   text,
  claim_date      timestamptz,
  quantity        integer    NOT NULL DEFAULT 1,
  status          text,
  raw_data        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, claim_id)
);

ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_claims" ON claims;
CREATE POLICY "select_own_claims" ON claims FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_claims" ON claims;
CREATE POLICY "insert_own_claims" ON claims FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_claims" ON claims;
CREATE POLICY "delete_own_claims" ON claims FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Claim Reasons Summary
CREATE TABLE IF NOT EXISTS claim_reasons_summary (
  id         uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     text       NOT NULL,
  count      integer    NOT NULL DEFAULT 0,
  percentage numeric(5,2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, reason)
);

ALTER TABLE claim_reasons_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_claim_reasons" ON claim_reasons_summary;
CREATE POLICY "select_own_claim_reasons" ON claim_reasons_summary FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_claim_reasons" ON claim_reasons_summary;
CREATE POLICY "insert_own_claim_reasons" ON claim_reasons_summary FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_claim_reasons" ON claim_reasons_summary;
CREATE POLICY "update_own_claim_reasons" ON claim_reasons_summary FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_claim_reasons" ON claim_reasons_summary;
CREATE POLICY "delete_own_claim_reasons" ON claim_reasons_summary FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Product Claim Stats
CREATE TABLE IF NOT EXISTS product_claim_stats (
  id              uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_barcode text       NOT NULL,
  product_name    text,
  total_claims    integer    NOT NULL DEFAULT 0,
  total_quantity  integer    NOT NULL DEFAULT 0,
  last_claim_date timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_barcode)
);

ALTER TABLE product_claim_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_product_stats" ON product_claim_stats;
CREATE POLICY "select_own_product_stats" ON product_claim_stats FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_product_stats" ON product_claim_stats;
CREATE POLICY "insert_own_product_stats" ON product_claim_stats FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_product_stats" ON product_claim_stats;
CREATE POLICY "update_own_product_stats" ON product_claim_stats FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_product_stats" ON product_claim_stats;
CREATE POLICY "delete_own_product_stats" ON product_claim_stats FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS claims_user_id_idx ON claims (user_id);
CREATE INDEX IF NOT EXISTS claims_product_barcode_idx ON claims (product_barcode);
CREATE INDEX IF NOT EXISTS claims_claim_date_idx ON claims (claim_date);
CREATE INDEX IF NOT EXISTS product_claim_stats_user_id_idx ON product_claim_stats (user_id);
CREATE INDEX IF NOT EXISTS claim_reasons_summary_user_id_idx ON claim_reasons_summary (user_id);
