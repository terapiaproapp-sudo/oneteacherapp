import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    const { type } = await req.json();

    if (type === "daily-summary") {
      return await handleDailySummary();
    } else if (type === "lesson-reminders") {
      return await handleLessonReminders();
    }

    return new Response("Invalid type", { status: 400 });
  } catch (error) {
    console.error("Error processing notifications:", error);
    return new Response(error.message, { status: 500 });
  }
});

async function handleDailySummary() {
  console.log("Processing daily summaries...");
  
  // 1. Get current hour in UTC
  const now = new Date();
  const currentUTC = now.toISOString();
  
  // 2. Fetch all profiles with daily summary enabled
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, notification_settings");
    
  if (error) throw error;
  
  for (const profile of profiles) {
    const settings = profile.notification_settings || {};
    if (!settings.daily_summary) continue;
    
    // Check if it's 07:00 AM in the user's timezone
    // We'll fetch the timezone from the latest subscription
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("subscription, device_info")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
      
    if (!subscriptions || subscriptions.length === 0) continue;
    
    const latestSub = subscriptions[0];
    const timezone = latestSub.device_info?.timezone || "UTC";
    const targetTime = settings.daily_summary_time || "07:00";
    
    // Check if current time in user's timezone matches targetTime
    const userLocalTime = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(now);
    
    if (userLocalTime === targetTime) {
      console.log(`Sending daily summary to ${profile.full_name} (${profile.id})`);
      
      // Fetch today's lessons for this user
      const today = new Date().toISOString().split("T")[0];
      const { data: lessons } = await supabase
        .from("lessons")
        .select("start_time, student:students(name)")
        .eq("teacher_id", profile.id)
        .gte("start_time", `${today}T00:00:00`)
        .lte("start_time", `${today}T23:59:59`)
        .neq("status", "cancelled")
        .order("start_time", { ascending: true });
        
      if (!lessons || lessons.length === 0) continue;
      
      const lessonCount = lessons.length;
      const lessonSummary = lessons.map(l => {
        const time = new Date(l.start_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
        return `${time} — ${l.student?.name || "Aluno"}`;
      }).join("\n");
      
      const title = "OneTeacher 📚";
      const body = `Você tem ${lessonCount} aula${lessonCount > 1 ? "s" : ""} hoje:\n${lessonSummary}`;
      
      // Send to all subscriptions for this user
      for (const sub of subscriptions) {
        await sendPush(sub.subscription, title, body);
      }
    }
  }
  
  return new Response("Daily summaries processed");
}

async function handleLessonReminders() {
  console.log("Processing lesson reminders...");
  const now = new Date();
  
  // Check lessons starting in the next 60 minutes
  const future = new Date(now.getTime() + 60 * 60 * 1000);
  
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, start_time, teacher_id, student:students(name), status")
    .gte("start_time", now.toISOString())
    .lte("start_time", future.toISOString())
    .neq("status", "cancelled")
    .neq("status", "completed")
    .neq("status", "no-show");
    
  if (error) throw error;
  
  for (const lesson of lessons) {
    // Get teacher settings
    const { data: profile } = await supabase
      .from("profiles")
      .select("notification_settings")
      .eq("id", lesson.teacher_id)
      .single();
      
    if (!profile || !profile.notification_settings?.lesson_reminder) continue;
    
    const leadTime = parseInt(profile.notification_settings.lesson_reminder_lead_time || "15");
    const startTime = new Date(lesson.start_time);
    const reminderTime = new Date(startTime.getTime() - leadTime * 60 * 1000);
    
    // Check if we are within the current 5-minute window for this reminder
    const diff = Math.abs(now.getTime() - reminderTime.getTime());
    if (diff < 5 * 60 * 1000) { // 5 minutes window
      // Check if already sent (could use a notification_logs table, 
      // but for now let's just send if it's the right time and rely on interval logic)
      // TODO: Implement idempotency if needed
      
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("subscription, device_info")
        .eq("user_id", lesson.teacher_id);
        
      if (!subscriptions) continue;
      
      const title = "OneTeacher 📚";
      const body = leadTime === 0 
        ? `Sua aula com ${lesson.student?.name} começa agora!` 
        : `Sua aula com ${lesson.student?.name} começa em ${leadTime} minutos.`;
      
      for (const sub of subscriptions) {
        const timezone = sub.device_info?.timezone || "UTC";
        // Double check if we already sent this recently?
        await sendPush(sub.subscription, title, body, { url: "/agenda" });
      }
    }
  }
  
  return new Response("Lesson reminders processed");
}

async function sendPush(subscription: any, title: string, body: string, data: any = {}) {
  const pushServiceUrl = `${supabaseUrl}/functions/v1/push-notifications`;
  await fetch(pushServiceUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ subscription, title, body, data }),
  });
}
