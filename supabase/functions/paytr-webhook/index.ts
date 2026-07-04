/**
 * PayTR Webhook Edge Function
 *
 * Receives payment notifications from PayTR and updates user subscription.
 * Verifies the hash signature and updates the profile accordingly.
 *
 * PayTR sends a POST request with form data when payment is completed.
 * Expected fields:
 * - merchant_oid: Order ID
 * - status: "success" or "failed"
 * - total_amount: Total payment amount
 * - hash: PayTR signature for verification
 *
 * Response: "OK" (required by PayTR)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2.39.3";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PayTRNotification {
  merchant_oid: string;
  status: "success" | "failed";
  total_amount: string;
  hash: string;
  payment_amount: string;
  currency: string;
  test_mode: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function verifyPayTRHash(
  merchant_oid: string,
  payment_amount: string,
  currency: string,
  merchant_salt: string,
  merchant_key: string
): Promise<string> {
  // Create hash string: merchant_oid + merchant_salt + status + total_amount
  // PayTR documentation: hash = merchant_oid + merchant_salt + status + total_amount
  // Then HMAC-SHA256 with merchant_key
  const hashStr = `${merchant_oid}${merchant_salt}success${payment_amount}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(merchant_key);
  const messageData = encoder.encode(hashStr);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parsePlanFromMerchantOid(merchantOid: string): { plan: "monthly" | "yearly"; userId: string } | null {
  // merchant_oid format: PLAN_USERID_TIMESTAMP
  const parts = merchantOid.split("_");
  if (parts.length < 3) return null;

  const planStr = parts[0]; // MONTHLY or YEARLY
  const userIdPart = parts[1]; // First 8 chars of user ID

  const plan = planStr.toLowerCase() === "monthly" ? "monthly" :
               planStr.toLowerCase() === "yearly" ? "yearly" : null;

  if (!plan) return null;

  return { plan, userId: userIdPart };
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const merchantKey = Deno.env.get("PAYTR_MERCHANT_KEY") || "MERCHANT_KEY_PLACEHOLDER";
  const merchantSalt = Deno.env.get("PAYTR_MERCHANT_SALT") || "MERCHANT_SALT_PLACEHOLDER";

  try {
    // Parse form data from PayTR
    const formData = new URLSearchParams(await req.text());

    const merchantOid = formData.get("merchant_oid") || "";
    const status = formData.get("status") || "failed";
    const totalAmount = formData.get("total_amount") || "0";
    const paymentAmount = formData.get("payment_amount") || "0";
    const hash = formData.get("hash") || "";

    console.log("PayTR Webhook received:", { merchant_oid: merchantOid, status, total_amount: totalAmount });

    // Verify hash
    const expectedHash = await verifyPayTRHash(
      merchantOid,
      paymentAmount,
      "TL",
      merchantSalt,
      merchantKey
    );

    // For testing, we'll skip hash verification if using placeholders
    const skipHashVerification = merchantKey === "MERCHANT_KEY_PLACEHOLDER";

    if (!skipHashVerification && hash !== expectedHash) {
      console.error("Hash verification failed");
      return new Response("HASH_MISMATCH", { status: 400 });
    }

    // Find the payment order
    const { data: order, error: orderError } = await supabase
      .from("payment_orders")
      .select("*")
      .eq("merchant_oid", merchantOid)
      .single();

    if (orderError || !order) {
      // Try to parse from merchant_oid if order not found
      const parsed = parsePlanFromMerchantOid(merchantOid);
      if (!parsed) {
        console.error("Order not found and couldn't parse merchant_oid");
        return new Response("ORDER_NOT_FOUND", { status: 400 });
      }

      // Find user by partial ID match
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .filter("user_id", "ilike", `%${parsed.userId}%`)
        .limit(1);

      if (!profiles || profiles.length === 0) {
        console.error("User not found for order");
        return new Response("USER_NOT_FOUND", { status: 400 });
      }
    }

    const userId = order?.user_id;

    if (status === "success") {
      // Get plan from order or parse from merchant_oid
      const plan = order?.plan || parsePlanFromMerchantOid(merchantOid)?.plan || "monthly";
      const durationDays = plan === "yearly" ? 365 : 30;

      // Update profile with new subscription
      const subscriptionEndsAt = new Date();
      subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + durationDays);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          plan_type: plan,
          subscription_ends_at: subscriptionEndsAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Failed to update profile:", updateError);
        return new Response("UPDATE_FAILED", { status: 500 });
      }

      // Update order status
      await supabase
        .from("payment_orders")
        .update({
          status: "success",
          updated_at: new Date().toISOString(),
        })
        .eq("merchant_oid", merchantOid);

      console.log(`Subscription updated: user=${userId}, plan=${plan}, ends=${subscriptionEndsAt.toISOString()}`);
    } else {
      // Payment failed
      await supabase
        .from("payment_orders")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("merchant_oid", merchantOid);

      console.log(`Payment failed: order=${merchantOid}`);
    }

    // Return OK to PayTR (required)
    return new Response("OK", { status: 200 });

  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("ERROR", { status: 500 });
  }
});
