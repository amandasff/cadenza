/**
 * Returns whether the current user has an active premium subscription.
 *
 * Currently returns true for everyone so existing users aren't affected.
 * When ready to enforce subscriptions, change the return to:
 *   return user?.subscription_status === 'active'
 */
export function useIsPremium(): boolean {
  return true;
}
