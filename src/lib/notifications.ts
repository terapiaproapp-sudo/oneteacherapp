import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = "BHCrETPTEoncHg0cNXyLowJpC2zkIeeZq8n4MjU8BXTUVnE3HWdb7BT6qqpSL2uVIPGaSfYbQamn8UJDVutgSRE";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    return null;
  }
}

export async function subscribeToPush(registration: ServiceWorkerRegistration, userId: string) {
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Save subscription to database
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      subscription: subscription.toJSON() as any,
      device_info: {
        userAgent: navigator.userAgent,
        platform: (navigator as any).platform || "unknown",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }, {
      onConflict: "user_id, subscription"
    });

    if (error) throw error;

    return subscription;
  } catch (error) {
    console.error("Failed to subscribe to push notifications:", error);
    throw error;
  }
}

export async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  try {
    await subscription.unsubscribe();
    // We don't necessarily need to delete it from the DB here, 
    // but we could if we wanted to be clean.
  } catch (error) {
    console.error("Failed to unsubscribe:", error);
  }
}

export async function getNotificationSettings(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("notification_settings")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching notification settings:", error);
    return null;
  }

  return data.notification_settings;
}

export async function updateNotificationSettings(userId: string, settings: any) {
  const { error } = await supabase
    .from("profiles")
    .update({ notification_settings: settings })
    .eq("id", userId);

  if (error) {
    console.error("Error updating notification settings:", error);
    throw error;
  }
}
