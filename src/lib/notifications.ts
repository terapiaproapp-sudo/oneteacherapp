import { supabase } from "./supabase";

const VAPID_PUBLIC_KEY = "BOtnVah5n55fg4QYjLpKZW-auiH-y4JaLERajGEIHo21apcy6haA-JJABoGsJL4YZ1f3j_5YiEJu3k7Y_kTGong";

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
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker não é suportado neste navegador.");
  }

  try {
    // Check if it's already registered
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length > 0) {
      return registrations[0];
    }

    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    
    // Wait for it to be ready
    await navigator.serviceWorker.ready;
    
    return registration;
  } catch (error: any) {
    console.error("Service Worker registration failed:", error);
    if (error.message?.includes("404")) {
      throw new Error("Arquivo sw.js não encontrado no servidor.");
    }
    throw new Error(`Falha ao registrar Service Worker: ${error.message}`);
  }
}

export async function subscribeToPush(registration: ServiceWorkerRegistration, userId: string) {
  try {
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

    // If an existing subscription uses a different applicationServerKey, unsubscribe first
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      const existingKey = existing.options?.applicationServerKey;
      const sameKey =
        existingKey &&
        new Uint8Array(existingKey).every((b, i) => b === applicationServerKey[i]) &&
        existingKey.byteLength === applicationServerKey.byteLength;

      if (!sameKey) {
        try {
          await existing.unsubscribe();
          // Remove stale subscription from DB
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", userId)
            .eq("subscription->>endpoint", existing.endpoint);
        } catch (e) {
          console.warn("Failed to unsubscribe old subscription:", e);
        }
      }
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
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
      onConflict: "user_id,endpoint"
    });

    if (error) throw error;

    return subscription;
  } catch (error) {
    console.error("Failed to subscribe to push notifications:", error);
    throw error;
  }
}

/**
 * Force re-subscribe: unsubscribe any current subscription, clean DB, then subscribe again
 * with the current VAPID_PUBLIC_KEY. Use when the device has a stale key.
 */
export async function reconfigurePushSubscription(userId: string) {
  const registration = await registerServiceWorker();
  if (!registration) throw new Error("Service Worker indisponível.");

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    const endpoint = existing.endpoint;
    try {
      await existing.unsubscribe();
    } catch (e) {
      console.warn("Unsubscribe failed:", e);
    }
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("subscription->>endpoint", endpoint);
  }

  const subscription = await subscribeToPush(registration, userId);
  return subscription;
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
