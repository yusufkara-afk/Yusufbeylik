/**
 * PayTR Payment Link Edge Function
 *
 * Creates a PayTR payment link for Pro subscription using the PayTR LINK API
 * (https://www.paytr.com/odeme/api/link/create) — NOT the iFrame/Direct API.
 *
 * IMPORTANT: The Link API and the iFrame API are two different PayTR products
 * with different required fields and different token hash formulas. Mixing
 * them (as the previous version of this file did) causes PayTR to reject the
 * request with "Gecersiz link_type degeri" because `link_type` — required by
 * the Link API — was never sent.
 *
 * Link API required fields: merchant_id, name, price, currency,
 * max_installment, link_type, lang, paytr_token.
 *
 * Required Environment Variables (Supabase Dashboard → Edge Functions → Secrets):
 * - PAYTR_MERCHANT_ID
 * - PAYTR_MERCHANT_KEY
 * - PAYTR_MERCHANT_SALT
 * - PAYTR_CALLBACK_URL (optional — webhook PayTR calls after a successful payment)
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

// ─── Constants ───────────────────────────────────────────────────────────────

const PLANS = {
  monthly: {
    name: 'IadeNabiz Aylik Pro Uyelik',
    price_try: 680,
    duration_days: 30,
  },
  yearly: {
    name: 'IadeNabiz Yillik Pro Uyelik',
    price_try: 4400,
    duration_days: 365,
  },
};

// ─── PayTR Link API ──────────────────────────────────────────────────────────

async function createPayTRPaylink(order: {
  merchant_oid: string;
  name: string;
  price_try: number; // TL, not kuruş
  plan: PlanType;
}): Promise<{ status: 'success' | 'error' | 'failed'; link?: string; id?: string; reason?: string }> {
  const merchantId = Deno.env.get("PAYTR_MERCHANT_ID");
  const merchantKey = Deno.env.get("PAYTR_MERCHANT_KEY");
  const merchantSalt = Deno.env.get("PAYTR_MERCHANT_SALT");
  const callbackUrl = Deno.env.get("PAYTR_CALLBACK_URL") || "";

  if (!merchantId || !merchantKey || !merchantSalt) {
    console.error("[createPayTRPaylink] Missing PAYTR secrets in Supabase Edge Function environment");
    return { status: "error", reason: "PAYTR_MERCHANT_ID/KEY/SALT Supabase secrets olarak tanımlı değil" };
  }

  // Link API expects price as integer, multiplied by 100 (kuruş)
  const price = Math.round(order.price_try * 100);
  const currency = "TL";
  const maxInstallment = 12; // 1-12 arası, taksit sınırı
  const linkType = "product"; // "product" veya "collection"
  const lang = "tr";

  // Link API token formula (per PayTR docs):
  // base64( HMAC-SHA256( name + price + currency + max_installment + link_type + lang + merchant_salt, key = merchant_key ) )
  const tokenBaseString = `${order.name}${price}${currency}${maxInstallment}${linkType}${lang}${merchantSalt}`;
  const paytrToken = await hmacSha256Base64(tokenBaseString, merchantKey);

  const formData = new URLSearchParams({
    merchant_id: merchantId,
    name: order.name,
    price: price.toString(),
    currency,
    max_installment: maxInstallment.toString(),
    link_type: linkType,
    lang,
    paytr_token: paytrToken,
    debug_on: "1",
  });

  if (callbackUrl) {
    formData.set("callback_link", callbackUrl);
    // callback_id lets you match the webhook back to this specific order
    formData.set("callback_id", order.merchant_oid);
  }

  try {
    const response = await fetch("https://www.paytr.com/odeme/api/link/create", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const rawText = await response.text();

    let result: { status?: string; link?: string; id?: string; reason?: string };
    try {
      result = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("[createPayTRPaylink] PayTR did not return JSON:", rawText.slice(0, 300));
      return { status: "error", reason: `PayTR JSON yerine beklenmeyen bir yanıt döndürdü: ${rawText.slice(0, 150)}` };
    }

    if (result.status === "success" && result.link) {
      return { status: "success", link: result.link, id: result.id };
    }

    console.error("[createPayTRPaylink] PayTR returned failure:", result);
    return { status: "error", reason: result.reason || "PayTR bilinmeyen bir hata döndürdü" };
  } catch (err) {
    console.error("[createPayTRPaylink] fetch to PayTR threw:", err);
    return { status: "error", reason: "PayTR API'sine ulaşılamadı (ağ hatası)" };
  }
}

async function hmacSha256Base64(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  // base64 encode (Deno has no Buffer by default, use btoa over byte string)
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const merchantOid = generateOrderId(plan, user.id);
    const planConfig = PLANS[plan];

    const result = await createPayTRPaylink({
      merchant_oid: merchantOid,
      name: planConfig.name,
      price_try: planConfig.price_try,
      plan,
    });

    if (result.status === "success" && result.link) {
      await supabase.from("payment_orders").upsert({
        user_id: user.id,
        merchant_oid: merchantOid,
        plan,
        amount: planConfig.price_try * 100,
        status: "pending",
        paytr_link_id: result.id,
        created_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          payment_url: result.link,
          plan,
          amount: planConfig.price_try,
          currency: "TL",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: "Ödeme linki oluşturulamadı: " + (result.reason || "Bilinmeyen hata"),
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[paytr-payment] Edge function error:", err);
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return new Response(
      JSON.stringify({ success: false, error: `Sunucu hatası: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
