/**
 * Trendyol API Sync Edge Function
 *
 * Bu fonksiyon Trendyol API'sinden iade (claim) verilerini çeker ve
 * Supabase veritabanına kaydeder.
 *
 * Endpoints:
 * - POST /sync-claims - Claim verilerini senkronize et
 * - POST /test-connection - Bağlantıyı test et
 * - DELETE /disconnect - Trendyol bağlantısını kaldır
 *
 * Trendyol API Docs: https://developers.trendyol.com/
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TrendyolCredentials {
  seller_id: string;
  api_key: string;
  api_secret: string;
}

interface TrendyolClaimItem {
  id: number;
  claimCode: number;
  claimItems?: Array<{
    productId: number;
    productName: string;
    productBarcode: string;
    quantity: number;
    reason: string;
    customerNote?: string;
  }>;
  status: string;
  claimDate: string;
  issueReason?: string;
  customerNote?: string;
}

interface TrendyolClaimsResponse {
  content: TrendyolClaimItem[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

interface SyncResult {
  success: boolean;
  message: string;
  claimsProcessed?: number;
  error?: string;
}

// ─── Trendyol API Client ─────────────────────────────────────────────────────

const TRENDYOL_BASE_URL = "https://apigw.trendyol.com";

async function buildAuthHeader(credentials: TrendyolCredentials): Promise<string> {
  const authString = `${credentials.api_key}:${credentials.api_secret}`;
  const base64Auth = btoa(authString);
  return `Basic ${base64Auth}`;
}

async function testTrendyolConnection(credentials: TrendyolCredentials): Promise<{ success: boolean; error?: string }> {
  try {
    const authHeader = await buildAuthHeader(credentials);
    const url = `${TRENDYOL_BASE_URL}/integration/pom/sellers/${credentials.seller_id}/claims?page=0&size=1`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Accept": "application/json",
        "User-Agent": "IadeNabiz/1.0",
      },
    });

    if (response.status === 401) {
      return { success: false, error: "API Key veya Secret hatalı. Lütfen bilgilerinizi kontrol edin." };
    }

    if (response.status === 403) {
      return { success: false, error: "Bu API anahtarı için erişim izni yok. Satıcı ID'nizi kontrol edin." };
    }

    if (response.status === 404) {
      return { success: false, error: "Satıcı ID bulunamadı. Lütfen kontrol edin." };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Trendyol API error: ${response.status} - ${errorText}`);
      return { success: false, error: `Bağlantı hatası (${response.status}). Lütfen daha sonra tekrar deneyin.` };
    }

    return { success: true };
  } catch (err) {
    console.error("Connection test error:", err);
    return { success: false, error: "Ağ bağlantı hatası. İnternet bağlantınızı kontrol edin." };
  }
}

async function fetchClaims(
  credentials: TrendyolCredentials,
  page: number = 0,
  size: number = 100
): Promise<TrendyolClaimsResponse | null> {
  const authHeader = await buildAuthHeader(credentials);
  const url = `${TRENDYOL_BASE_URL}/integration/pom/sellers/${credentials.seller_id}/claims?page=${page}&size=${size}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": authHeader,
      "Accept": "application/json",
      "User-Agent": "IadeNabiz/1.0",
    },
  });

  if (!response.ok) {
    console.error(`Failed to fetch claims: ${response.status}`);
    return null;
  }

  return await response.json();
}

// ─── Database Operations ─────────────────────────────────────────────────────

import { createClient } from "npm:@supabase/supabase-js@2.39.3";

async function saveCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  credentials: TrendyolCredentials
): Promise<{ success: boolean; error?: string }> {
  // Upsert credentials - insert or update
  const { error } = await supabase
    .from("trendyol_credentials")
    .upsert(
      {
        user_id: userId,
        seller_id: credentials.seller_id,
        api_key: credentials.api_key,
        api_secret: credentials.api_secret,
        status: "active",
        last_sync_at: null,
        error_message: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    console.error("Failed to save credentials:", error);
    return { success: false, error: "Kimlik bilgileri kaydedilemedi." };
  }

  return { success: true };
}

async function getCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<TrendyolCredentials | null> {
  const { data, error } = await supabase
    .from("trendyol_credentials")
    .select("seller_id, api_key, api_secret")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    seller_id: data.seller_id,
    api_key: data.api_key,
    api_secret: data.api_secret,
  };
}

async function deleteCredentials(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ success: boolean }> {
  await supabase.from("trendyol_credentials").delete().eq("user_id", userId);
  await supabase.from("claims").delete().eq("user_id", userId);
  await supabase.from("claim_reasons_summary").delete().eq("user_id", userId);
  await supabase.from("product_claim_stats").delete().eq("user_id", userId);

  return { success: true };
}

async function updateCredentialStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  await supabase
    .from("trendyol_credentials")
    .update({
      status,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

async function saveClaims(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  claims: TrendyolClaimItem[]
): Promise<number> {
  if (claims.length === 0) return 0;

  // Flatten claim items and prepare for insert
  const claimsToInsert: Array<{
    user_id: string;
    claim_id: number;
    product_name: string | null;
    product_barcode: string | null;
    claim_reason: string | null;
    customer_note: string | null;
    claim_date: string | null;
    quantity: number;
    status: string;
    raw_data: object;
  }> = [];

  for (const claim of claims) {
    // Her claim birden fazla ürün içerebilir
    if (claim.claimItems && claim.claimItems.length > 0) {
      for (const item of claim.claimItems) {
        claimsToInsert.push({
          user_id: userId,
          claim_id: claim.id,
          product_name: item.productName || null,
          product_barcode: item.productBarcode || null,
          claim_reason: item.reason || claim.issueReason || null,
          customer_note: item.customerNote || claim.customerNote || null,
          claim_date: claim.claimDate || null,
          quantity: item.quantity || 1,
          status: claim.status,
          raw_data: claim,
        });
      }
    } else {
      // Tek ürün claim
      claimsToInsert.push({
        user_id: userId,
        claim_id: claim.id,
        product_name: null,
        product_barcode: null,
        claim_reason: claim.issueReason || null,
        customer_note: claim.customerNote || null,
        claim_date: claim.claimDate || null,
        quantity: 1,
        status: claim.status,
        raw_data: claim,
      });
    }
  }

  // Batch insert with conflict handling
  const { error } = await supabase
    .from("claims")
    .upsert(claimsToInsert, { onConflict: "user_id,claim_id" });

  if (error) {
    console.error("Failed to save claims:", error);
    return 0;
  }

  return claimsToInsert.length;
}

async function updateClaimStats(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<void> {
  // Get all claims for user and calculate stats
  const { data: claims, error } = await supabase
    .from("claims")
    .select("product_barcode, product_name, claim_reason, quantity, claim_date")
    .eq("user_id", userId);

  if (error || !claims || claims.length === 0) return;

  // Ürün bazında grupla
  const productStats: Record<string, { name: string; count: number; quantity: number; lastDate: string }> = {};

  for (const claim of claims) {
    const barcode = claim.product_barcode || "unknown";
    if (!productStats[barcode]) {
      productStats[barcode] = {
        name: claim.product_name || "Bilinmeyen Ürün",
        count: 0,
        quantity: 0,
        lastDate: claim.claim_date || new Date().toISOString(),
      };
    }
    productStats[barcode].count += 1;
    productStats[barcode].quantity += claim.quantity || 1;
    if (claim.claim_date && new Date(claim.claim_date) > new Date(productStats[barcode].lastDate)) {
      productStats[barcode].lastDate = claim.claim_date;
    }
  }

  // Update product_claim_stats
  const productStatsData = Object.entries(productStats).map(([barcode, stats]) => ({
    user_id: userId,
    product_barcode: barcode,
    product_name: stats.name,
    total_claims: stats.count,
    total_quantity: stats.quantity,
    last_claim_date: stats.lastDate,
    updated_at: new Date().toISOString(),
  }));

  await supabase.from("product_claim_stats").upsert(productStatsData, { onConflict: "user_id,product_barcode" });

  // Sebep bazında grupla
  const reasonStats: Record<string, number> = {};
  let totalReasons = 0;

  for (const claim of claims) {
    const reason = claim.claim_reason || "Belirtilmemiş";
    reasonStats[reason] = (reasonStats[reason] || 0) + 1;
    totalReasons += 1;
  }

  // Update claim_reasons_summary
  const reasonStatsData = Object.entries(reasonStats).map(([reason, count]) => ({
    user_id: userId,
    reason,
    count,
    percentage: totalReasons > 0 ? Math.round((count / totalReasons) * 10000) / 100 : 0,
    updated_at: new Date().toISOString(),
  }));

  await supabase.from("claim_reasons_summary").upsert(reasonStatsData, { onConflict: "user_id,reason" });
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/trendyol-sync", "");

    // Extract user ID from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Yetkilendirme gerekli" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Geçersiz token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // ─── Test Connection ──────────────────────────────────────────────────────
    if (path === "/test-connection" && req.method === "POST") {
      const body = await req.json();
      const credentials: TrendyolCredentials = {
        seller_id: body.seller_id,
        api_key: body.api_key,
        api_secret: body.api_secret,
      };

      if (!credentials.seller_id || !credentials.api_key || !credentials.api_secret) {
        return new Response(
          JSON.stringify({ success: false, error: "Tüm alanları doldurun" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const testResult = await testTrendyolConnection(credentials);

      if (testResult.success) {
        await saveCredentials(supabase, userId, credentials);
        return new Response(
          JSON.stringify({ success: true, message: "Trendyol hesabınız başarıyla bağlandı" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, error: testResult.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ─── Sync Claims ─────────────────────────────────────────────────────────
    if (path === "/sync-claims" && req.method === "POST") {
      const credentials = await getCredentials(supabase, userId);

      if (!credentials) {
        return new Response(
          JSON.stringify({ success: false, error: "Trendyol hesabı bağlı değil" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Test connection first
      const testResult = await testTrendyolConnection(credentials);
      if (!testResult.success) {
        await updateCredentialStatus(supabase, userId, "failed", testResult.error);
        return new Response(
          JSON.stringify({ success: false, error: testResult.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch all claims (pagination)
      let totalProcessed = 0;
      let page = 0;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        const claimsData = await fetchClaims(credentials, page, pageSize);

        if (!claimsData) {
          hasMore = false;
          break;
        }

        if (claimsData.content && claimsData.content.length > 0) {
          const saved = await saveClaims(supabase, userId, claimsData.content);
          totalProcessed += saved;
        }

        hasMore = claimsData.totalPages > page + 1;
        page += 1;
      }

      // Update stats
      await updateClaimStats(supabase, userId);

      // Update last sync time
      await supabase
        .from("trendyol_credentials")
        .update({
          status: "active",
          last_sync_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({
          success: true,
          message: `${totalProcessed} iade kaydı başarıyla senkronize edildi`,
          claimsProcessed: totalProcessed,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Get Connection Status ───────────────────────────────────────────────
    if (path === "/status" && req.method === "GET") {
      const { data: cred } = await supabase
        .from("trendyol_credentials")
        .select("status, last_sync_at, error_message, seller_id, created_at")
        .eq("user_id", userId)
        .single();

      if (!cred) {
        return new Response(
          JSON.stringify({ connected: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          connected: cred.status === "active",
          status: cred.status,
          last_sync_at: cred.last_sync_at,
          error_message: cred.error_message,
          seller_id: cred.seller_id,
          connected_at: cred.created_at,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Disconnect ──────────────────────────────────────────────────────────
    if (path === "/disconnect" && req.method === "DELETE") {
      await deleteCredentials(supabase, userId);

      return new Response(
        JSON.stringify({ success: true, message: "Trendyol bağlantısı kaldırıldı" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Unknown Endpoint ────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ error: "Bilinmeyen endpoint" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Edge function error:", err);
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";

    return new Response(
      JSON.stringify({ success: false, error: `Sunucu hatası: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
