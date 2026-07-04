/*
# Create profiles table for user plans and subscriptions

## Summary
Her kullanici icin plan ve uyelik bilgilerini tutan profiles tablosunu olusturur.
Yeni kullanilar otomatik olarak 7 gunluk trial (deneme) suresine dahil edilir.

## New Tables

### `profiles`
- `id` (uuid, primary key) - auth.users ile ayni ID
- `user_id` (uuid, not null, unique, references auth.users) - kullanicinin auth ID'si
- `email` (text, not null) - kullanicinin e-posta adresi
- `plan_type` (text, not null, default 'trial') - 'trial' | 'monthly' | 'yearly' | 'expired'
- `trial_started_at` (timestamptz) - deneme suresi baslangic tarihi
- `trial_ends_at` (timestamptz) - deneme suresi bitis tarihi (kayit + 7 gun)
- `subscription_ends_at` (timestamptz) - odemeli uyelik bitis tarihi
- `paytr_token` (text) - PayTR odeme token (varsa)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

## Security
- RLS etkin
- Her kullanici sadece kendi profilini gorebilir/guncelleyebilir

## Automation
- Yeni kullanici kaydoldugunda otomatik profile olusturan trigger

## Notes
1. Trial suresi kayit aninda baslar ve 7 gun surer
2. Trial bittiginde plan_type 'expired' olarak guncellenir (uygulama katmaninda)
3. Odeme basarili oldugunda plan_type 'monthly' veya 'yearly' olarak guncellenir
*/

CREATE TABLE IF NOT EXISTS profiles (
  id                  uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid       NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text       NOT NULL,
  plan_type           text       NOT NULL DEFAULT 'trial' CHECK (plan_type IN ('trial', 'monthly', 'yearly', 'expired')),
  trial_started_at    timestamptz NOT NULL DEFAULT now(),
  trial_ends_at       timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  subscription_ends_at timestamptz,
  paytr_token         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles (user_id);
CREATE INDEX IF NOT EXISTS profiles_plan_type_idx ON profiles (plan_type);

-- Function to automatically create profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
