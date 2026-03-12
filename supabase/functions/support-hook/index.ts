import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * support-hook
 * - Sends Telegram notification when a logged-in user sends a support message.
 *
 * IMPORTANT:
 * - Deploy with Verify JWT OFF (or via CLI: --no-verify-jwt).
 * - This function still verifies the user via Authorization header.
 *
 * Required secrets (Edge Functions -> Secrets):
 * - TELEGRAM_BOT_TOKEN
 * - TELEGRAM_CHAT_ID
 * - SUPABASE_URL (usually auto)
 * - SUPABASE_ANON_KEY (usually auto)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function safeJson(req: Request): Promise<any | null | "__INVALID_JSON__"> {
  const raw = await req.text().catch(() => "");
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return "__INVALID_JSON__";
  }
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY" }, 500);
    }
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return json({ error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" }, 500);
    }

    const body = await safeJson(req);
    if (body === "__INVALID_JSON__") return json({ error: "Invalid JSON body" }, 400);
    if (body === null) return json({ error: "Missing JSON body" }, 400);

    const roomName = String(body.room_name ?? "").trim();
    const messageText = String(body.message ?? "").trim();

    if (!messageText) return json({ error: "Missing message" }, 400);

    // Verify caller is authenticated (requires Authorization header)
    const authHeader = req.headers.get("Authorization") ?? "";
    const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await authed.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const senderId = userData.user.id;
    const senderName =
      userData.user.user_metadata?.display_name ||
      userData.user.user_metadata?.full_name ||
      userData.user.email ||
      senderId;

    const telegramText =
      `📩 New support message\n` +
      `From: ${senderName}\n` +
      (roomName ? `Room: ${roomName}\n` : "") +
      `Message: ${messageText}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: telegramText,
        disable_web_page_preview: true,
      }),
    });

    const tgBody = await tgRes.text().catch(() => "");
    if (!tgRes.ok) {
      console.error("Telegram error:", tgRes.status, tgBody);
      return json({ ok: false, telegram_status: tgRes.status, telegram_response: tgBody.slice(0, 400) }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("support-hook fatal:", e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
