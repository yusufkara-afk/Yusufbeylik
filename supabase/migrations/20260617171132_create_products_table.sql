/*
# Create products table

## Summary
Her satıcının kendi ürünlerini saklayacağı `products` tablosunu oluşturur.
Multi-user yapı: her satır bir kullanıcıya aittir, RLS ile izole edilmiştir.

## New Tables
- `products`
  - `id` (uuid, primary key) — benzersiz ürün kimliği
  - `user_id` (uuid, not null, default auth.uid()) — sahibi olan kullanıcı
  - `name` (text, not null) — ürün adı
  - `return_rate` (numeric, not null, default 0) — iade oranı (yüzde)
  - `estimated_loss` (numeric, not null, default 0) — tahmini kayıp (TL)
  - `status` (text, not null, default 'watch') — 'stop' | 'watch' | 'go'
  - `created_at` (timestamptz, default now())

## Security
- RLS etkinleştirildi.
- 4 ayrı politika (select / insert / update / delete), yalnızca `authenticated` rolü.
- Kullanıcılar yalnızca kendi satırlarını görebilir/değiştirebilir.

## Notes
1. `user_id` default olarak `auth.uid()` alır; frontend insert sırasında user_id göndermek zorunda değil.
2. `status` için check constraint: yalnızca geçerli değerler kabul edilir.
*/

CREATE TABLE IF NOT EXISTS products (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  return_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (return_rate >= 0 AND return_rate <= 100),
  estimated_loss numeric(12,2) NOT NULL DEFAULT 0 CHECK (estimated_loss >= 0),
  status      text        NOT NULL DEFAULT 'watch' CHECK (status IN ('stop', 'watch', 'go')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_products" ON products;
CREATE POLICY "select_own_products" ON products FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_products" ON products;
CREATE POLICY "insert_own_products" ON products FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_products" ON products;
CREATE POLICY "update_own_products" ON products FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_products" ON products;
CREATE POLICY "delete_own_products" ON products FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS products_user_id_idx ON products (user_id);
