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
  const now = new Date();
  
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, notification_settings");
    
  if (error) throw error;
  
  for (const profile of profiles) {
    const settings = profile.notification_settings || {};
    if (!settings.daily_summary) continue;
    
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("subscription, device_info")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
      
    if (!subscriptions || subscriptions.length === 0) continue;
    
    const latestSub = subscriptions[0];
    const timezone = latestSub.device_info?.timezone || "UTC";
    const targetTime = settings.daily_summary_time || "07:00";
    
    const userLocalTime = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(now);
    
    if (userLocalTime === targetTime) {
      // Get today's date in user's timezone
      const userLocalDate = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      const [m, d, y] = userLocalDate.split("/");
      const todayString = `${y}-${m}-${d}`;

      console.log(`Sending daily summary to ${profile.full_name} for date ${todayString}`);
      
      const { data: lessons } = await supabase
        .from("lessons")
        .select("time, student:students(name)")
        .eq("teacher_id", profile.id)
        .eq("date", todayString)
        .neq("status", "cancelled")
        .order("time", { ascending: true });
        
      if (!lessons || lessons.length === 0) continue;
      
      const lessonCount = lessons.length;
      const lessonSummary = lessons.map(l => `${l.time} — ${l.student?.name || "Aluno"}`).join("\n");
      
      const title = "OneTeacher 📚";
      const body = `Você tem ${lessonCount} aula${lessonCount > 1 ? "s" : ""} hoje:\n${lessonSummary}`;
      
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
  
  // Get current date string for querying
  const todayUTC = now.toISOString().split("T")[0];
  
  const { data: lessons, error } = await supabase
    .from("lessons")
    .select("id, date, time, teacher_id, student:students(name), status")
    .eq("date", todayUTC) // Simplified, might miss edge cases across midnight but usually teachers don't teach then
    .neq("status", "cancelled")
    .neq("status", "completed")
    .neq("status", "no-show");
    
  if (error) throw error;
  
  for (const lesson of lessons) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("notification_settings")
      .eq("id", lesson.teacher_id)
      .single();
      
    if (!profile || !profile.notification_settings?.lesson_reminder) continue;
    
    const leadTime = parseInt(profile.notification_settings.lesson_reminder_lead_time || "15");
    
    // Parse lesson time
    const [hours, minutes] = lesson.time.split(":").map(Number);
    const lessonDate = new Date(lesson.date + "T" + lesson.time + ":00");
    
    // We need to know the teacher's timezone to correctly interpret "lessonDate"
    // For now assume the stored date/time are relative to teacher's local time
    
    const reminderTime = new Date(lessonDate.getTime() - leadTime * 60 * 1000);
    
    const diff = Math.abs(now.getTime() - reminderTime.getTime());
    if (diff < 5 * 60 * 1000) { 
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("subscription")
        .eq("user_id", lesson.teacher_id);
        
      if (!subscriptions) continue;
      
      const title = "OneTeacher 📚";
      const body = leadTime === 0 
        ? `Sua aula com ${lesson.student?.name} começa agora!` 
        : `Sua aula com ${lesson.student?.name} começa em ${leadTime} minutos.`;
      
      for (const sub of subscriptions) {
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
  }).catch(err => console.error("Push delivery error:", err));
}
