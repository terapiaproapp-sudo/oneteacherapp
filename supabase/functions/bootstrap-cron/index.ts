import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  // Only allow caller that already knows the service role key
  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const sb = createClient(supabaseUrl, serviceKey);
  // Upsert vault secret 'service_role_key'
  const { error } = await sb.rpc("upsert_service_role_secret", { p_value: serviceKey });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});