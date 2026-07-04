import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder-key');

export type ProductStatus = 'stop' | 'watch' | 'go';

export interface Product {
  id: string;
  user_id: string;
  name: string;
  return_rate: number;
  estimated_loss: number;
  status: ProductStatus;
  created_at: string;
}

export interface TrendyolCredentials {
  id: string;
  user_id: string;
  seller_id: string;
  status: 'pending' | 'active' | 'failed' | 'disconnected';
  last_sync_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  id: string;
  user_id: string;
  claim_id: number;
  product_name: string | null;
  product_barcode: string | null;
  claim_reason: string | null;
  customer_note: string | null;
  claim_date: string | null;
  quantity: number;
  status: string;
  raw_data: Record<string, unknown>;
  created_at: string;
}

export interface ClaimReasonSummary {
  id: string;
  user_id: string;
  reason: string;
  count: number;
  percentage: number;
  updated_at: string;
}

export interface ProductClaimStats {
  id: string;
  user_id: string;
  product_barcode: string;
  product_name: string | null;
  total_claims: number;
  total_quantity: number;
  last_claim_date: string | null;
  updated_at: string;
}

export type PlanType = 'trial' | 'monthly' | 'yearly' | 'expired';

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  plan_type: PlanType;
  trial_started_at: string;
  trial_ends_at: string;
  subscription_ends_at: string | null;
  paytr_token: string | null;
  created_at: string;
  updated_at: string;
}
