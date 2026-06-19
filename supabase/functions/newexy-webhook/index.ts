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

// Mapeia o evento recebido para a ação comercial a ser aplicada no perfil.
// Apenas eventos confirmados nesta integração são tratados; demais ficam registrados
// como "ignored" (idempotência) sem alterar o estado do usuário.
type Action =
  | { type: "activate"; plan?: string; next_billing?: string }
  | { type: "mark_pending" }
  | { type: "mark_recusado" }
  | { type: "mark_cancelado" }
  | { type: "mark_expirado" }
  | { type: "mark_reembolsado" }
  | { type: "ignore" };

function classifyEvent(event: string): Action {
  switch (event) {
    case "payment.approved":
      return { type: "activate" };
    case "payment.pending":
      return { type: "mark_pending" };
    case "payment.refused":
    case "payment.declined":
    case "payment.failed":
      return { type: "mark_recusado" };
    case "subscription.canceled":
    case "subscription.cancelled":
      return { type: "mark_cancelado" };
    case "subscription.expired":
      return { type: "mark_expirado" };
    case "payment.refunded":
    case "payment.chargeback":
    case "payment.disputed":
      return { type: "mark_reembolsado" };
    default:
      return { type: "ignore" };
  }
}

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

  // Identificador único do evento — usado para idempotência.
  // A Newexy deve enviar um dos campos abaixo; se nenhum vier, derivamos um id estável.
  const event_id =
    (typeof body.event_id === "string" && body.event_id) ||
    (typeof body.id === "string" && body.id) ||
    (typeof body.transaction_id === "string" && body.transaction_id) ||
    (typeof body.payment_id === "string" && body.payment_id) ||
    `${event}:${email}:${next_billing ?? ""}`;

  if (!event) {
    return json(400, { error: "missing_event" });
  }

  // 2. Idempotência: tenta reservar o evento antes de processar.
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

  const action = classifyEvent(event);

  if (action.type === "ignore") {
    await finalize("ignored", null);
    return json(200, { success: true, ignored: true });
  }

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

  // 4. Aplica a mudança comercial conforme o tipo de evento.
  let update: Record<string, unknown> = {};
  switch (action.type) {
    case "activate":
      update = { plan: plan ?? undefined, status: "ativo", validade: next_billing ?? undefined };
      break;
    case "mark_pending":
      // Não libera plano pago; apenas registra estado. Se o usuário ainda tiver
      // teste/plano válido, o usePlanGuard mantém o acesso até o vencimento.
      update = { status: "pendente" };
      break;
    case "mark_recusado":
      update = { status: "recusado" };
      break;
    case "mark_cancelado":
      // Mantém validade já paga; impede renovação futura (sem alterar validade).
      update = { status: "cancelado" };
      break;
    case "mark_expirado":
      update = { status: "expirado" };
      break;
    case "mark_reembolsado":
      update = { status: "reembolsado", validade: new Date().toISOString().slice(0, 10) };
      break;
  }

  // Remove chaves undefined antes do update
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
