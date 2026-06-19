import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Único evento confirmado por payload real recebido em produção.
// Qualquer outro evento é gravado como `nao_mapeado` para auditoria,
// SEM alterar plano/status/validade do perfil. Aliases especulativos
// foram removidos para evitar mudanças de acesso baseadas em suposição.
const CONFIRMED_APPROVED_EVENT = "payment.approved";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  // 1. Autenticação: api_key só existe no servidor, nunca é logada nem retornada.
  const NEWEXY_API_KEY = Deno.env.get("NEWEXY_API_KEY");
  const providedKey = typeof body.api_key === "string" ? body.api_key : "";
  if (!NEWEXY_API_KEY || !providedKey || providedKey !== NEWEXY_API_KEY) {
    console.error("webhook auth failed");
    return json(401, { error: "unauthorized" });
  }

  const event = typeof body.event === "string" ? body.event : "";
  const email = typeof body.email === "string" ? body.email.toLowerCase() : "";
  const plan = typeof body.plan === "string" ? body.plan : undefined;
  const next_billing =
    typeof body.next_billing === "string" ? body.next_billing : undefined;

  // Identificador único e imutável do evento — APENAS campos reais da Newexy.
  // Sem fallback derivado de e-mail/plano/data: se não houver id real, NÃO ativamos.
  const realEventId =
    (typeof body.event_id === "string" && body.event_id) ||
    (typeof body.transaction_id === "string" && body.transaction_id) ||
    (typeof body.payment_id === "string" && body.payment_id) ||
    (typeof body.id === "string" && body.id) ||
    "";

  if (!event) {
    return json(400, { error: "missing_event" });
  }

  const isConfirmedApproved = event === CONFIRMED_APPROVED_EVENT;

  // ---- Evento não confirmado: SOMENTE auditoria, nunca altera perfil. ----
  if (!isConfirmedApproved) {
    // Usa um id sintético APENAS para evitar lotar a tabela com chamadas iguais;
    // nunca é usado para ativar plano.
    const auditId =
      realEventId || `audit:${event}:${email}:${Date.now()}:${crypto.randomUUID()}`;
    const { error: auditError } = await supabase
      .from("webhook_events")
      .insert({
        provider: "newexy",
        event_id: auditId,
        event_type: event,
        status: "nao_mapeado",
        email: email || null,
        plan: plan ?? null,
        error: "EVENT_NOT_CONFIRMED",
      });
    if (auditError && (auditError as any).code !== "23505") {
      console.error("failed to audit unmapped event", auditError.message);
    }
    return json(200, { success: true, audited: true, mutated: false });
  }

  // ---- A partir daqui, somente payment.approved confirmado ----

  // Idempotência: exige id único REAL.
  if (!realEventId) {
    await supabase.from("webhook_events").insert({
      provider: "newexy",
      event_id: `missing:${crypto.randomUUID()}`,
      event_type: event,
      status: "error",
      email: email || null,
      plan: plan ?? null,
      error: "WEBHOOK_UNIQUE_ID_MISSING",
    });
    console.error("WEBHOOK_UNIQUE_ID_MISSING");
    return json(400, { error: "missing_unique_id" });
  }

  const event_id = realEventId;

  // Reserva o evento antes de processar.
  const { error: reserveError } = await supabase
    .from("webhook_events")
    .insert({
      provider: "newexy",
      event_id,
      event_type: event,
      status: "received",
      email: email || null,
      plan: plan ?? null,
    });

  if (reserveError) {
    // 23505 = unique_violation → já processado antes.
    if ((reserveError as any).code === "23505") {
      console.log(`duplicate event ignored: ${event} ${event_id}`);
      return json(200, { success: true, duplicate: true });
    }
    console.error("failed to reserve webhook event", reserveError.message);
    return json(500, { error: "internal_error" });
  }

  const finalize = async (
    status: string,
    user_id: string | null,
    error?: string
  ) => {
    await supabase
      .from("webhook_events")
      .update({ status, user_id, error: error ?? null })
      .eq("provider", "newexy")
      .eq("event_id", event_id);
  };

  if (!email) {
    await finalize("error", null, "MISSING_EMAIL");
    return json(400, { error: "missing_email" });
  }

  // 3. Localiza o usuário existente. NUNCA cria perfil órfão.
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (fetchError) {
    console.error("profiles lookup failed", fetchError.message);
    await finalize("error", null, "PROFILE_LOOKUP_FAILED");
    return json(500, { error: "internal_error" });
  }

  if (!profile) {
    // Confirma também em auth.users — se nem usuário existe, o pagamento é órfão.
    let userId: string | null = null;
    try {
      const { data: userList } = await supabase.auth.admin.listUsers();
      const match = userList?.users?.find(
        (u) => (u.email ?? "").toLowerCase() === email
      );
      userId = match?.id ?? null;
    } catch (e) {
      console.error("auth lookup failed");
    }

    console.error(`PAYMENT_APPROVED_USER_NOT_FOUND event=${event}`);
    await finalize("error", userId, "PAYMENT_APPROVED_USER_NOT_FOUND");
    return json(404, { error: "user_not_found" });
  }

  // Ativação por payment.approved confirmado.
  const update: Record<string, unknown> = {
    plan: plan ?? undefined,
    status: "ativo",
    validade: next_billing ?? undefined,
  };
  Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

  if (Object.keys(update).length > 0) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update(update)
      .eq("id", profile.id);

    if (updateError) {
      console.error("profile update failed", updateError.message);
      await finalize("error", profile.id, "PROFILE_UPDATE_FAILED");
      return json(500, { error: "internal_error" });
    }
  }

  await finalize("processed", profile.id);
  return json(200, { success: true });
});
