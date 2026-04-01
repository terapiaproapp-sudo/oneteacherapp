import { supabase } from "@/lib/supabase";

export async function logActivity(action: string, details: Record<string, unknown> = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("activity_logs").insert([{
      user_id: user.id,
      action,
      details: details as any,
    }]);
  } catch (e) {
    console.error("Activity log error:", e);
  }
}
