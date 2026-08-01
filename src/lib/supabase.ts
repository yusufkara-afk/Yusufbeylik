import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe environment variable access with fallbacks
const getEnvVar = (key: string, fallback: string): string => {
  try {
    const value = (import.meta.env as Record<string, string | undefined>)[key];
    if (value && typeof value === 'string' && value.length > 0) {
      return value;
    }
    console.warn(`[Supabase] Environment variable ${key} not set, using fallback`);
    return fallback;
  } catch (error) {
    console.error(`[Supabase] Error reading ${key}:`, error);
    return fallback;
  }
};

// Fallback values for production
const FALLBACK_URL = 'https://ytguuqnefjkwyirjmbks.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0Z3V1cW5lZmprd3lpcmptYmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTE5NDYsImV4cCI6MjA5NzI4Nzk0Nn0.0vBOVpcECeo92GtHM4Lh1MmROgbUBGGwQDapdKPYbRI';

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL', FALLBACK_URL);
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY', FALLBACK_KEY);

// Track initialization error
let initializationError: string | null = null;
let supabaseClient: SupabaseClient | null = null;

try {
  console.log('[Supabase] Initializing client...');
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  console.log('[Supabase] Client initialized successfully');
} catch (error) {
  initializationError = error instanceof Error ? error.message : 'Failed to initialize Supabase client';
  console.error('[Supabase] Initialization failed:', initializationError);
  // Create a dummy client that won't crash the app
  try {
    supabaseClient = createClient(FALLBACK_URL, FALLBACK_KEY);
  } catch {
    // Last resort - this should never fail with hardcoded values
    console.error('[Supabase] Critical: Fallback client creation failed');
  }
}

export const supabase = supabaseClient!;
export const getSupabaseError = () => initializationError;
export const isSupabaseInitialized = () => supabaseClient !== null && initializationError === null;

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
