import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    // Verify the calling user (teacher)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await supabaseClient.auth.getUser();
    if (!caller) throw new Error("Não autenticado");

    const { user_id, new_password } = await req.json();
    if (!user_id || !new_password) throw new Error("ID do usuário e nova senha são obrigatórios");
    if (new_password.length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres");

    // Admin client to update password
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the user_id belongs to a student access record of this teacher
    const { data: accessRecord } = await supabaseAdmin
      .from("student_access")
      .select("id")
      .eq("user_id", user_id)
      .eq("teacher_id", caller.id)
      .maybeSingle();

    if (!accessRecord) {
      throw new Error("Acesso do aluno não encontrado ou sem permissão");
    }

    // Update the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateError) {
      console.error("Error updating password:", updateError);
      throw new Error("Erro ao redefinir senha");
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Senha redefinida com sucesso"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro desconhecido ao redefinir senha",
        code: "FUNCTION_ERROR"
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
