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

    const { student_id, email, password, student_name } = await req.json();
    if (!student_id || !email || !password) throw new Error("E-mail e senha são obrigatórios");
    if (email.trim() === "") throw new Error("E-mail não pode estar vazio");
    if (password.length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres");

    // Verify caller is the teacher of this student
    const { data: student } = await supabaseClient
      .from("students")
      .select("teacher_id")
      .eq("id", student_id)
      .single();
    if (!student || student.teacher_id !== caller.id) throw new Error("Sem permissão para criar acesso deste aluno");

    // Admin client to create user
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if this student already has an access record (to prevent duplicates)
    const { data: existingForStudent } = await supabaseAdmin
      .from("student_access")
      .select("id, user_id, is_active")
      .eq("student_id", student_id)
      .maybeSingle();

    // If student already has access, reactivate or return success
    if (existingForStudent) {
      // Reactivate if was deactivated
      if (!existingForStudent.is_active) {
        await supabaseAdmin
          .from("student_access")
          .update({ is_active: true })
          .eq("id", existingForStudent.id);
      }
      return new Response(
        JSON.stringify({ success: true, user_id: existingForStudent.user_id, reused: true, reactivated: !existingForStudent.is_active }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to create the auth user; if email already exists, reuse it
    let userId: string | null = null;
    let createdNow = false;
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: student_name || "" },
    });

    if (createError) {
      const msg = (createError.message || "").toLowerCase();
      const isDuplicate =
        msg.includes("already") || msg.includes("email") || (createError as any).status === 422 || (createError as any).code === "email_exists";
      if (!isDuplicate) {
        console.error("Error creating user:", createError);
        throw new Error("Erro ao criar usuário de acesso do aluno");
      }

      // Find existing user by email by paginating listUsers
      let page = 1;
      const perPage = 1000;
      while (!userId) {
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (listErr) {
          console.error("Error listing users:", listErr);
          throw new Error("Erro ao buscar e-mail no sistema");
        }
        const found = list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase().trim());
        if (found) { userId = found.id; break; }
        if (list.users.length < perPage) break;
        page += 1;
      }
      if (!userId) throw new Error("E-mail já registrado no sistema, mas não foi possível encontrá-lo");
    } else {
      userId = newUser.user.id;
      createdNow = true;
    }

    // Check if this email is already linked to another student
    const { data: existingForUser } = await supabaseAdmin
      .from("student_access")
      .select("id, student_id, teacher_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingForUser) {
      // If this email belongs to another student, don't allow it
      if (existingForUser.student_id !== student_id) {
        // Clean up newly created user if we just created one
        if (createdNow && userId) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(userId);
          } catch (e) {
            console.error("Error deleting user:", e);
          }
        }
        return new Response(
          JSON.stringify({
            error: "Este e-mail já está vinculado a um outro aluno. Use um e-mail diferente.",
            code: "EMAIL_ALREADY_LINKED"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // If it's the same student, reactivate
      if (!existingForUser || !existingForUser.id) {
        throw new Error("Erro inesperado ao verificar acesso existente");
      }
      await supabaseAdmin
        .from("student_access")
        .update({ is_active: true })
        .eq("id", existingForUser.id);
      return new Response(
        JSON.stringify({ success: true, user_id: userId, reused: true, reactivated: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the student_access record
    const { data: createdAccess, error: accessError } = await supabaseAdmin
      .from("student_access")
      .insert({
        student_id,
        user_id: userId,
        teacher_id: caller.id,
      })
      .select()
      .single();

    if (accessError) {
      console.error("Error creating student_access:", accessError);
      // Clean up newly created user if we just created one
      if (createdNow && userId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userId);
        } catch (e) {
          console.error("Error deleting user:", e);
        }
      }
      throw new Error("Erro ao vincular e-mail ao aluno. Tente novamente.");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: userId, 
        access_id: createdAccess?.id,
        reused: !createdNow,
        message: createdNow ? "Acesso do aluno criado com sucesso" : "Acesso do aluno ativado com sucesso"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro desconhecido ao criar acesso",
        code: "FUNCTION_ERROR"
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
