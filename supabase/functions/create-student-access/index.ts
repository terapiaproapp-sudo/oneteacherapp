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

    // Verify caller is the teacher of this student
    const { data: student } = await supabaseClient
      .from("students")
      .select("teacher_id")
      .eq("id", student_id)
      .single();
    if (!student || student.teacher_id !== caller.id) throw new Error("Sem permissão");

    // Admin client to create user
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Try to create the auth user; if email already exists, reuse it
    let userId: string | null = null;
    let createdNow = false;
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: student_name || "" },
    });

    if (createError) {
      const msg = (createError.message || "").toLowerCase();
      const isDuplicate =
        msg.includes("already") || (createError as any).status === 422 || (createError as any).code === "email_exists";
      if (!isDuplicate) throw createError;

      // Find existing user by email by paginating listUsers
      let page = 1;
      const perPage = 1000;
      while (!userId) {
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (listErr) throw listErr;
        const found = list.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
        if (found) { userId = found.id; break; }
        if (list.users.length < perPage) break;
        page += 1;
      }
      if (!userId) throw new Error("Email já registrado, mas usuário não encontrado");
    } else {
      userId = newUser.user.id;
      createdNow = true;
    }

    // Check if student_access already exists for this student or user
    const { data: existingForStudent } = await supabaseAdmin
      .from("student_access")
      .select("id")
      .eq("student_id", student_id)
      .maybeSingle();

    if (existingForStudent) {
      return new Response(
        JSON.stringify({ error: "Este aluno já possui acesso configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: existingForUser } = await supabaseAdmin
      .from("student_access")
      .select("id, student_id, teacher_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingForUser) {
      return new Response(
        JSON.stringify({
          error: "Este e-mail já está vinculado a outro aluno. Use um e-mail diferente.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: accessError } = await supabaseAdmin
      .from("student_access")
      .insert({
        student_id,
        user_id: userId,
        teacher_id: caller.id,
      });

    if (accessError) {
      if (createdNow && userId) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      throw accessError;
    }

    return new Response(
      JSON.stringify({ success: true, user_id: userId, reused: !createdNow }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
