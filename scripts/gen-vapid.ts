/**
 * Run once to generate VAPID keys for push notifications.
 * Then add the output to your Vercel environment variables.
 *
 * Usage: bun scripts/gen-vapid.ts
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\n✅ VAPID keys generated. Add these to Vercel Environment Variables:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:your@email.com\n`);
console.log("⚠️  Keep VAPID_PRIVATE_KEY and VAPID_EMAIL server-only (not NEXT_PUBLIC_).");
console.log("⚠️  Generate once — changing keys will break existing subscriptions.\n");
