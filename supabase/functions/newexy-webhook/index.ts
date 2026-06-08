import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { event, email, plan, next_billing, api_key } = body;

    // 1. Valide a api_key
    const NEWEXY_API_KEY = Deno.env.get("NEWEXY_API_KEY");
    if (!api_key || api_key !== NEWEXY_API_KEY) {
      console.error("Invalid API key provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event !== "payment.approved") {
      return new Response(JSON.stringify({ message: "Event ignored" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing payment.approved for ${email}, plan: ${plan}`);

    // 2. Busque o professor na tabela perfis pelo email
    const { data: profile, error: fetchError } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching profile:", fetchError);
      throw fetchError;
    }

    if (profile) {
      // 3. Atualize perfis
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({
          plan: plan,
          status: "ativo",
          validade: next_billing,
        })
        .eq("id", profile.id);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        throw updateError;
      }
      console.log(`Profile ${email} updated successfully`);
    } else {
      // 4. Se o professor não existir ainda (opcional: criar perfil se email for chave)
      // Nota: Profiles geralmente são criados no trigger de auth.users.
      // Se não existe profile, talvez devêssemos apenas registrar que o email está pago
      // ou criar um perfil básico.
      console.log(`Profile ${email} not found. Creating a new one.`);
      const { error: insertError } = await supabaseClient
        .from("profiles")
        .insert({
          email: email,
          plan: plan,
          status: "ativo",
          validade: next_billing,
        });

      if (insertError) {
        console.error("Error inserting profile:", insertError);
        throw insertError;
      }
      console.log(`New profile created for ${email}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
