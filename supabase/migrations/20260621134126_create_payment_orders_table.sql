/*
# Create payment_orders table

## Summary
Odeme islemlerini takip etmek icin payment_orders tablosu olusturur.
PayTR webhook'undan gelen bildirimleri eslestirmek icin kullanilir.

## New Tables

### `payment_orders`
- `id` (uuid, primary key)
- `user_id` (uuid, not null, references auth.users)
- `merchant_oid` (text, not null, unique) - PayTR siparis ID'si
- `plan` (text, not null) - 'monthly' veya 'yearly'
- `amount` (integer, not null) - tutar (kurus cinsinden)
- `status` (text, not null, default 'pending') - 'pending' | 'success' | 'failed'
- `paytr_token` (text) - PayTR token (varsa)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

## Security
- RLS etkin
- Her kullanici sadece kendi siparislerini gorebilir

## Notes
1. merchant_oid format: PLAN_USERID_TIMESTAMP (orn: MONTHLY_abc123_1234567890)
2. Webhook bu tabloyu kullanarak odeme basarisini kaydeder
*/

CREATE TABLE IF NOT EXISTS payment_orders (
  id           uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid       NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_oid text       NOT NULL UNIQUE,
  plan         text       NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  amount       integer    NOT NULL,
  status       text       NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  paytr_token  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_orders" ON payment_orders;
CREATE POLICY "select_own_orders" ON payment_orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_orders" ON payment_orders;
CREATE POLICY "insert_own_orders" ON payment_orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS payment_orders_user_id_idx ON payment_orders (user_id);
CREATE INDEX IF NOT EXISTS payment_orders_status_idx ON payment_orders (status);

-- Update trigger
CREATE TRIGGER update_payment_orders_updated_at
  BEFORE UPDATE ON payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
