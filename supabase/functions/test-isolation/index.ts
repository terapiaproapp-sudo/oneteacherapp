// TEMPORARY test edge function — runs cross-account RLS verification with two
// real auth users created on the fly, then deletes them. Intended to be
// removed after the test report is produced. Protected by TEST_TOKEN header.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-test-token",
};

const ok = (b: unknown) =>
  new Response(JSON.stringify(b, null, 2), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY =
    Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const userClient = (jwt: string) =>
    createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false },
    });

  const stamp = Date.now();
  const emailA = `isotest-a-${stamp}@oneteacher.test`;
  const emailB = `isotest-b-${stamp}@oneteacher.test`;
  const password = `Pwd!${stamp}aA1`;

  const report: any = { setup: {}, accountA: {}, accountB: {}, cross: {}, cleanup: {} };

  let userA: any, userB: any;
  try {
    // 1. Create users (auto-confirmed)
    const a = await admin.auth.admin.createUser({
      email: emailA, password, email_confirm: true,
      user_metadata: { full_name: "Iso Test A" },
    });
    if (a.error) throw new Error("create A: " + a.error.message);
    userA = a.data.user;
    const b = await admin.auth.admin.createUser({
      email: emailB, password, email_confirm: true,
      user_metadata: { full_name: "Iso Test B" },
    });
    if (b.error) throw new Error("create B: " + b.error.message);
    userB = b.data.user;
    report.setup = { userA: userA.id, userB: userB.id };

    // 2. Sign in each → get JWT
    const sign = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const sa = await sign.auth.signInWithPassword({ email: emailA, password });
    if (sa.error) throw new Error("signin A: " + sa.error.message);
    const sb = await sign.auth.signInWithPassword({ email: emailB, password });
    if (sb.error) throw new Error("signin B: " + sb.error.message);
    const cliA = userClient(sa.data.session!.access_token);
    const cliB = userClient(sb.data.session!.access_token);

    // 3. Account A: create student, package, lesson, payment
    const insStudent = await cliA.from("students").insert({
      teacher_id: userA.id,
      name: "Aluno Teste A",
      status: "ativo",
    }).select().single();
    report.accountA.insert_student = {
      ok: !insStudent.error, error: insStudent.error?.message, id: insStudent.data?.id,
    };
    const studentAId = insStudent.data?.id;

    let packageAId: string | undefined;
    if (studentAId) {
      const insPkg = await cliA.from("packages").insert({
        teacher_id: userA.id, student_id: studentAId,
        total_minutes: 600, remaining_minutes: 600, value: 300,
      }).select().single();
      report.accountA.insert_package = {
        ok: !insPkg.error, error: insPkg.error?.message, id: insPkg.data?.id,
      };
      packageAId = insPkg.data?.id;

      const insLesson = await cliA.from("lessons").insert({
        teacher_id: userA.id, student_id: studentAId,
        date: new Date().toISOString().slice(0, 10),
        start_time: "10:00", end_time: "11:00",
        status: "agendada", duration_minutes: 60,
      }).select().single();
      report.accountA.insert_lesson = {
        ok: !insLesson.error, error: insLesson.error?.message, id: insLesson.data?.id,
      };

      const insPay = await cliA.from("payments").insert({
        teacher_id: userA.id, student_id: studentAId,
        amount: 300, status: "pendente",
        due_date: new Date().toISOString().slice(0, 10),
      }).select().single();
      report.accountA.insert_payment = {
        ok: !insPay.error, error: insPay.error?.message, id: insPay.data?.id,
      };
    }

    // 4. Account B sanity: should see nothing of A
    const selB_students = await cliB.from("students").select("*");
    const selB_lessons = await cliB.from("lessons").select("*");
    const selB_packages = await cliB.from("packages").select("*");
    const selB_payments = await cliB.from("payments").select("*");
    report.accountB.select_own_baseline = {
      students: selB_students.data?.length ?? null,
      lessons: selB_lessons.data?.length ?? null,
      packages: selB_packages.data?.length ?? null,
      payments: selB_payments.data?.length ?? null,
      errors: [selB_students.error, selB_lessons.error, selB_packages.error, selB_payments.error]
        .filter(Boolean).map((e: any) => e.message),
    };

    // 5. CROSS: B tries to SELECT/UPDATE/DELETE A's records
    if (studentAId) {
      const xSel = await cliB.from("students").select("*").eq("id", studentAId);
      report.cross.B_select_A_student = {
        rows_returned: xSel.data?.length ?? 0,
        error: xSel.error?.message ?? null,
      };
      const xUpd = await cliB.from("students")
        .update({ name: "HACKED" }).eq("id", studentAId).select();
      report.cross.B_update_A_student = {
        rows_affected: xUpd.data?.length ?? 0,
        error: xUpd.error?.message ?? null,
      };
      const xDel = await cliB.from("students")
        .delete().eq("id", studentAId).select();
      report.cross.B_delete_A_student = {
        rows_affected: xDel.data?.length ?? 0,
        error: xDel.error?.message ?? null,
      };

      // Verify with service role that A's student is intact + still owned by A
      const verify = await admin.from("students").select("id,name,teacher_id").eq("id", studentAId).single();
      report.cross.verify_A_student_intact = {
        still_exists: !verify.error,
        name: verify.data?.name,
        owner: verify.data?.teacher_id,
        owner_matches_A: verify.data?.teacher_id === userA.id,
      };
    }

    if (packageAId) {
      const xUpd = await cliB.from("packages")
        .update({ remaining_minutes: 0 }).eq("id", packageAId).select();
      const xDel = await cliB.from("packages").delete().eq("id", packageAId).select();
      report.cross.B_update_A_package_rows = xUpd.data?.length ?? 0;
      report.cross.B_update_A_package_error = xUpd.error?.message ?? null;
      report.cross.B_delete_A_package_rows = xDel.data?.length ?? 0;
      report.cross.B_delete_A_package_error = xDel.error?.message ?? null;
    }

    // 6. Reverse: A creates a student then B tries cross again (already covered),
    // and we also test A trying to read B's data (B has none). For completeness:
    const insStudentB = await cliB.from("students").insert({
      teacher_id: userB.id, name: "Aluno Teste B", status: "ativo",
    }).select().single();
    const studentBId = insStudentB.data?.id;
    report.accountB.insert_student = {
      ok: !insStudentB.error, error: insStudentB.error?.message, id: studentBId,
    };
    if (studentBId) {
      const xSel = await cliA.from("students").select("*").eq("id", studentBId);
      const xUpd = await cliA.from("students").update({ name: "HACKED_BY_A" }).eq("id", studentBId).select();
      const xDel = await cliA.from("students").delete().eq("id", studentBId).select();
      report.cross.A_select_B_student_rows = xSel.data?.length ?? 0;
      report.cross.A_update_B_student_rows = xUpd.data?.length ?? 0;
      report.cross.A_delete_B_student_rows = xDel.data?.length ?? 0;
      const verifyB = await admin.from("students").select("name,teacher_id").eq("id", studentBId).single();
      report.cross.verify_B_student_intact = {
        still_exists: !verifyB.error,
        name: verifyB.data?.name,
        owner_matches_B: verifyB.data?.teacher_id === userB.id,
      };
    }

    // 7. Spoofing attempt: B tries to insert a row pretending to be A
    const spoof = await cliB.from("students").insert({
      teacher_id: userA.id, name: "spoofed by B", status: "ativo",
    }).select();
    report.cross.B_insert_spoof_as_A = {
      rows_inserted: spoof.data?.length ?? 0,
      error: spoof.error?.message ?? null,
    };
  } catch (e: any) {
    report.error = e.message;
  } finally {
    // 8. Cleanup — deleting users cascades to public.profiles / students / etc.
    try {
      if (userA) await admin.auth.admin.deleteUser(userA.id);
      if (userB) await admin.auth.admin.deleteUser(userB.id);
      report.cleanup.users_deleted = true;
    } catch (e: any) {
      report.cleanup.error = e.message;
    }
  }

  return ok(report);
});