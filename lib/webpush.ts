import webpush from 'web-push';

let initialized = false;

/** Returns a configured webpush instance, or null if VAPID keys aren't set. */
export function getWebPush(): typeof webpush | null {
  if (initialized) return webpush;
  const { VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_EMAIL || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return null;
  webpush.setVapidDetails(VAPID_EMAIL, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  initialized = true;
  return webpush;
}
