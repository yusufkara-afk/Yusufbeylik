/**
 * PayTR Payment Link Edge Function
 *
 * Creates a PayTR payment link for Pro subscription.
 * Supports monthly ($20 ≈ 680 TL) and yearly ($129 ≈ 4,400 TL) plans.
 *
 * PayTR API Documentation: https://dev.paytr.com/
 *
 * Required Environment Variables (set in Supabase Dashboard):
 * - PAYTR_MERCHANT_ID: Your PayTR Merchant ID
 * - PAYTR_MERCHANT_KEY: Your PayTR Merchant Key
 * - PAYTR_MERCHANT_SALT: Your PayTR Merchant Salt
 * - PAYTR_OK_URL: URL to redirect after successful payment
 * - PAYTR_FAIL_URL: URL to redirect after failed payment
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Types ───────────────────────────────────────────────────────────────────

type PlanType = 'monthly' | 'yearly';

interface PaymentRequest {
  plan: PlanType;
  email: string;
  user_id: string;
}

interface PaymentResponse {
  success: boolean;
  payment_url?: string;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// USD to TRY exchange rate (approximate, can be updated)
const USD_TO_TRY = 34;

const PLANS = {
  monthly: {
    name: 'Aylık Pro Üyelik',
    price_usd: 20,
    price_try: 680,
    duration_days: 30,
    description: '1 aylık Pro üyelik',
  },
  yearly: {
    name: 'Yıllık Pro Üyelik',
    price_usd: 129,
    price_try: 4400,
    duration_days: 365,
    description: '1 yıllık Pro üyelik',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createPayTRPaylink(
  order: {
    merchant_oid: string;
    email: string;
    amount: number; // in kuruş (1 TL = 100 kuruş)
    user_name: string;
    user_ip: string;
    plan: PlanType;
  }
): Promise<{ status: 'success' | 'fail'; payment_url?: string; reason?: string }> {
  const merchantId = Deno.env.get("PAYTR_MERCHANT_ID") || "MERCHANT_ID_PLACEHOLDER";
  const merchantKey = Deno.env.get("PAYTR_MERCHANT_KEY") || "MERCHANT_KEY_PLACEHOLDER";
  const merchantSalt = Deno.env.get("PAYTR_MERCHANT_SALT") || "MERCHANT_SALT_PLACEHOLDER";
  const okUrl = Deno.env.get("PAYTR_OK_URL") || "https://example.com/payment/success";
  const failUrl = Deno.env.get("PAYTR_FAIL_URL") || "https://example.com/payment/fail";

  const plan = PLANS[order.plan];

  // User basket - JSON format required by PayTR
  const userBasket = JSON.stringify([
    [plan.name, order.amount / 100, 1],
  ]);

  // Create hash token
  const hashStr = `${merchantId}${order.user_ip}${order.merchant_oid}${order.email}${order.amount}${userBasket}${okUrl}${failUrl}`;
  const tokenData = await createHmacSHA256(hashStr, merchantSalt, merchantKey);

  // Prepare form data
  const formData = new URLSearchParams({
    merchant_id: merchantId,
    merchant_oid: order.merchant_oid,
    payment_amount: order.amount.toString(),
    paytr_token: tokenData,
    user_ip: order.user_ip,
    merchant_ok_url: okUrl,
    merchant_fail_url: failUrl,
    user_name: order.user_name,
    user_email: order.email,
    user_phone: "", // Optional
    user_address: "", // Optional
    user_basket: userBasket,
    timeout_limit: "30",
    currency: "TL",
    test_mode: "1", // Set to "0" in production - test mode for development
    debug_on: "1",
    lang: "tr",
  });

  // Store plan info in merchant_oid format: "PLAN_USER_TIMESTAMP" for webhook parsing
  // merchant_oid format: PLAN_USER_TIMESTAMP where we can extract plan type later

  try {
    const response = await fetch("https://www.paytr.com/odeme/api/link/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const result = await response.json();

    if (result.status === "success" && result.payment_url) {
      return { status: "success", payment_url: result.payment_url };
    } else {
      return { status: "fail", reason: result.reason || "PayTR API error" };
    }
  } catch (err) {
    console.error("PayTR API request failed:", err);
    return { status: "fail", reason: "Network error" };
  }
}

async function createHmacSHA256(data: string, salt: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const saltData = encoder.encode(salt);
  const messageData = encoder.encode(data);

  // Import key for HMAC
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Concatenate salt + message
  const combined = new Uint8Array(saltData.length + messageData.length);
  combined.set(saltData, 0);
  combined.set(messageData, saltData.length);

  // Sign
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, combined);

  // Convert to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOrderId(plan: PlanType, userId: string): string {
  const timestamp = Date.now();
  const shortId = userId.substring(0, 8);
  return `${plan.toUpperCase()}_${shortId}_${timestamp}`;
}

// ─── Supabase Client ─────────────────────────────────────────────────────────

import { createClient } from "npm:@supabase/supabase-js@2.39.3";

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Yetkilendirme gerekli" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Geçersiz token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: PaymentRequest = await req.json();
    const { plan } = body;

    if (!plan || !['monthly', 'yearly'].includes(plan)) {
      return new Response(
        JSON.stringify({ success: false, error: "Geçersiz plan seçimi" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: "Kullanıcı profili bulunamadı" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique order ID
    const merchantOid = generateOrderId(plan, user.id);
    const planConfig = PLANS[plan];

    // Create PayTR payment link
    const result = await createPayTRPaylink({
      merchant_oid: merchantOid,
      email: user.email || profile.email,
      amount: planConfig.price_try * 100, // Convert to kuruş
      user_name: user.email?.split('@')[0] || "User",
      user_ip: "127.0.0.1", // Will be replaced by actual IP in production
      plan: plan,
    });

    if (result.status === "success" && result.payment_url) {
      // Store the order info for webhook verification
      await supabase.from("payment_orders").upsert({
        user_id: user.id,
        merchant_oid: merchantOid,
        plan: plan,
        amount: planConfig.price_try * 100,
        status: "pending",
        created_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          payment_url: result.payment_url,
          plan: plan,
          amount: planConfig.price_try,
          currency: "TL",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Ödeme linki oluşturulamadı: " + (result.reason || "Bilinmeyen hata"),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.error("Edge function error:", err);
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";

    return new Response(
      JSON.stringify({ success: false, error: `Sunucu hatası: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
