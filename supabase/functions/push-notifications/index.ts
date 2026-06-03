import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let stage = "init";
  try {
    stage = "authorize";
    const authHeader = req.headers.get("Authorization") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { stage, error: "Unauthorized" });
    }
    const bearer = authHeader.slice("Bearer ".length);
    const isServiceCall = !!serviceRoleKey && bearer === serviceRoleKey;
    if (!isServiceCall) {
      if (!supabaseUrl || !supabaseAnon) {
        return json(500, { stage, error: "Auth not configured" });
      }
      const sb = createClient(supabaseUrl, supabaseAnon, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await sb.auth.getClaims(bearer);
      if (error || !data?.claims) {
        return json(401, { stage, error: "Unauthorized" });
      }
    }

    stage = "parse_body";
    const { subscription, title, body, data } = await req.json();

    stage = "validate_subscription";
    if (!subscription || typeof subscription !== "object") {
      return json(400, { stage, error: "subscription ausente ou inválida" });
    }
    if (!subscription.endpoint || typeof subscription.endpoint !== "string") {
      return json(400, { stage, error: "subscription.endpoint ausente" });
    }
    if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
      return json(400, { stage, error: "subscription.keys.p256dh/auth ausentes" });
    }

    stage = "read_vapid";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    console.log("VAPID present:", {
      public: !!vapidPublicKey,
      private: !!vapidPrivateKey,
      publicLen: vapidPublicKey?.length ?? 0,
      privateLen: vapidPrivateKey?.length ?? 0,
    });
    if (!vapidPublicKey || !vapidPrivateKey) {
      return json(500, { stage, error: "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes nos Secrets" });
    }

    stage = "set_vapid";
    try {
      webpush.setVapidDetails(
        "mailto:suporte@oneteacher.app",
        vapidPublicKey,
        vapidPrivateKey,
      );
    } catch (e: any) {
      return json(500, { stage, error: `VAPID inválido: ${e?.message ?? e}` });
    }

    stage = "send";
    const payload = JSON.stringify({
      title: title ?? "OneTeacher",
      body: body ?? "Notificação de teste",
      icon: "/favicon.png",
      data: data || {},
    });
    console.log("Sending push to endpoint:", subscription.endpoint.slice(0, 60) + "...");

    try {
      const result = await webpush.sendNotification(subscription, payload);
      console.log("Push sent OK, statusCode:", result?.statusCode);
      return json(200, { success: true, statusCode: result?.statusCode ?? null });
    } catch (e: any) {
      const statusCode = e?.statusCode;
      const body = e?.body;
      console.error("web-push error:", { statusCode, body, message: e?.message });
      if (statusCode === 404 || statusCode === 410) {
        return json(410, { stage, error: "endpoint expirado/desconhecido (gone)", statusCode });
      }
      if (statusCode === 401 || statusCode === 403) {
        return json(401, { stage, error: "VAPID rejeitado pelo push service", statusCode, body });
      }
      return json(502, { stage, error: e?.message ?? "falha web-push", statusCode, body });
    }
  } catch (error: any) {
    console.error("Unhandled error at stage", stage, error);
    return json(500, { stage, error: error?.message ?? String(error) });
  }
});
