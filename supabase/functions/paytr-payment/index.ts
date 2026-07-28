/**
 * supabase/functions/paytr-payment/index.ts
 *
 * Supabase Edge Function to create a PayTR payment link.
 *
 * - Normalizes prices to integer kuruş (multiply by 100 and round)
 * - Builds a PayTR Link payload and posts to the configured PayTR Link API
 * - Computes a signature/hash; adjust `computePaytrSignature` to match the exact
 *   algorithm PayTR expects (see inline doc)
 *
 * Usage:
 *  - POST JSON body with either:
 *      { amount: 49.99, order_id: "order-123", name, email, phone, ... }
 *    or
 *      { items: [{id, title, unit_price, quantity}], order_id, name, email, phone, ... }
 *
 * NOTE: Verify and set environment variables in Supabase Function config.
 */

import { serve } from "std/server";

/**
 * Normalizes a price into integer kuruş.
 * Accepts numbers or numeric strings (e.g. "49.99", 49.99, "49,99").
 * Returns integer value in kuruş (e.g., 49.99 -> 4999).
 *
 * Rationale:
 * - Accepts comma or dot decimal separators.
 * - Rounds to nearest kuruş (Math.round) to avoid floating point imprecision.
 */
function normalizePriceToKurus(value: number | string): number {
  if (value == null || value === "") throw new TypeError("Price is required");
  let s = typeof value === "string" ? value.trim() : String(value);
  // allow comma decimal separators
  s = s.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number(s);
  if (!Number.isFinite(parsed) || isNaN(parsed)) {
    throw new TypeError(`Invalid price value: ${value}`);
  }
  // Multiply by 100 and round to nearest integer kuruş
  const kurus = Math.round(parsed * 100);
  if (!Number.isFinite(kurus) || Number.isNaN(kurus) || !Number.isInteger(kurus)) {
    throw new TypeError(`Could not normalize price to integer kuruş: ${value}`);
  }
  // Enforce non-negative and at least 1 kuruş
  return Math.max(0, kurus);
}

/**
 * Normalize a list of line items to a total kuruş amount.
 * Each item must have unit_price (number|string) and optional quantity (default 1).
 */
function totalFromItemsInKurus(items: Array<{ unit_price: number | string; quantity?: number }>): number {
  if (!Array.isArray(items) || items.length === 0) throw new TypeError("items must be a non-empty array");
  let total = 0;
  for (const it of items) {
    if (it == null) throw new TypeError("item is null");
    const qty = it.quantity == null ? 1 : Number(it.quantity);
    if (!Number.isFinite(qty) || qty < 0) throw new TypeError("invalid quantity");
    const unit = normalizePriceToKurus(it.unit_price);
    total += unit * Math.round(qty);
  }
  return total;
}

/**
 * Helper: base64 encode an ArrayBuffer
 */
function base64Encode(buffer: ArrayBuffer): string {
  // browser/Deno compatible
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  // btoa works in Deno and browser contexts for small arrays; this is safe here.
  return btoa(binary);
}

/**
 * Compute HMAC-SHA256 and return base64 string.
 * Uses Web Crypto API (available in Supabase Edge Functions / Deno runtime).
 */
async function hmacSha256Base64(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(key);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return base64Encode(sig);
}

/**
 * Compute the PayTR signature/hash for Link API.
 *
 * PayTR's exact signature algorithm must be followed. This helper provides a
 * common HMAC-SHA256 variant using merchant_key as HMAC key and a chosen
 * concatenation of fields as the message. If your PayTR docs specify a
 * different ordering / salt usage (e.g., merchant_id|order_id|amount|salt),
 * change the 'message' construction accordingly.
 *
 * Example (update to match PayTR spec exactly):
 *   const message = merchant_id + order_id + total_amount_kurus + merchant_salt;
 *   const signature = await hmacSha256Base64(merchant_key, message);
 *
 * Replace or update this function if your integration requires a different hash.
 */
async function computePaytrSignature(payloadForSigning: string): Promise<string> {
  // Default uses merchant key as HMAC key. payloadForSigning should be built by the caller.
  const merchantKey = Deno.env.get("PAYTR_MERCHANT_KEY") ?? Deno.env.get("PAYTR_API_KEY") ?? "";
  if (!merchantKey) throw new Error("Missing PAYTR_MERCHANT_KEY environment variable");
  return await hmacSha256Base64(merchantKey, payloadForSigning);
}

/**
 * Minimal request body validation and normalization.
 * Accepts either `amount` or `items` to compute total.
 */
type CreateLinkRequest = {
  order_id: string;
  amount?: number | string; // human-readable (e.g., 49.99)
  items?: Array<{ id?: string; title?: string; unit_price: number | string; quantity?: number }>;
  name?: string;
  email?: string;
  phone?: string;
  currency?: string; // default 'TRY'
  description?: string;
  expire_period_min?: number; // optional expiration in minutes
};

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid or missing JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const payload = body as CreateLinkRequest;
    if (!payload.order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Determine amount in kuruş
    let totalKurus = 0;
    if (payload.items && Array.isArray(payload.items) && payload.items.length > 0) {
      totalKurus = totalFromItemsInKurus(payload.items);
    } else if (payload.amount != null) {
      totalKurus = normalizePriceToKurus(payload.amount);
    } else {
      return new Response(JSON.stringify({ error: "Either amount or items must be provided" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    if (totalKurus <= 0) {
      return new Response(JSON.stringify({ error: "Total amount must be greater than zero" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Basic payer info
    const name = String(payload.name ?? "").trim();
    const email = String(payload.email ?? "").trim();
    const phone = String(payload.phone ?? "").trim();

    // Build PayTR request
    const merchantId = Deno.env.get("PAYTR_MERCHANT_ID") ?? "";
    const merchantSalt = Deno.env.get("PAYTR_MERCHANT_SALT") ?? "";
    const baseUrl = Deno.env.get("PAYTR_BASE_URL") ?? "https://www.paytr.com/odeme/api/link"; // adjust as needed
    const successUrl = Deno.env.get("PAYTR_SUCCESS_URL") ?? "";
    const failUrl = Deno.env.get("PAYTR_FAIL_URL") ?? "";
    const testMode = (Deno.env.get("PAYTR_TEST_MODE") ?? "0") === "1" ? 1 : 0;
    const currency = payload.currency ?? "TRY";
    if (!merchantId || !merchantSalt) {
      return new Response(JSON.stringify({ error: "PAYTR_MERCHANT_ID or PAYTR_MERCHANT_SALT not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    // PayTR's API typically expects amount in the smallest currency unit as an integer
    // but sometimes requires it as a string. We'll send as string here.
    const amountStr = String(totalKurus);

    // Build the canonical string for signing according to your PayTR integration.
    // NOTE: This MUST be adapted to the exact ordering PayTR specifies. Example:
    //   const signingString = merchantId + payload.order_id + amountStr + merchantSalt;
    // or if PayTR wants merchant_key used differently, adapt accordingly.
    const signingString = merchantId + payload.order_id + amountStr + merchantSalt;

    // Compute signature
    const paytrSignature = await computePaytrSignature(signingString);

    // Build request body according to PayTR Link API fields. Adjust names/fields to exact API:
    const paytrRequestBody: Record<string, any> = {
      merchant_id: merchantId,
      order_id: payload.order_id,
      amount: amountStr,
      currency,
      name,
      email,
      phone,
      description: payload.description ?? `Payment for ${payload.order_id}`,
      success_url: successUrl,
      fail_url: failUrl,
      expire_period_min: payload.expire_period_min ?? undefined,
      test_mode: testMode,
      signature: paytrSignature, // field name may differ: change to 'hash' or 'paytr_token' per your API
    };

    // Remove undefined entries
    for (const k of Object.keys(paytrRequestBody)) {
      if (paytrRequestBody[k] === undefined || paytrRequestBody[k] === "") delete paytrRequestBody[k];
    }

    // Post to PayTR Link API
    const resp = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(paytrRequestBody),
    });

    const text = await resp.text();
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "PayTR returned non-OK status", status: resp.status, body: parsed }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    // Success: return PayTR response directly to client
    return new Response(JSON.stringify({ success: true, paytr_response: parsed }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("paytr-link-error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
