/**
 * Manager Plan Service
 *
 * Manager / admin access is now driven by `users.role` in Supabase, not by a
 * hardcoded email whitelist. To keep the existing call sites synchronous
 * (`isManagerPlanUser(user?.email)`), we maintain an in-memory cache populated
 * once after sign-in by `refreshManagerStatusForUser()` (called from
 * AuthContext) or by the `useUserRole` hook.
 *
 * If the cache hasn't been populated yet for a given email, the function
 * returns false — the consumer will re-render once the cache fills and the
 * downstream UI rights itself. Hardcoded production emails were removed.
 */

import { supabase } from './supabase';

const managerEmailCache = new Set<string>();
const checkedEmailCache = new Set<string>();

// Legacy Tech/Founder accounts created before role migration. Keep this
// temporary compatibility list so those accounts are not blocked by an old
// public.users row while the role column is being backfilled.
const legacyTechEmails = new Set(['7bd02025@gmail.com', 'jihadalcc@gmail.com']);

function normalize(email: string | undefined | null): string | null {
    if (!email) return null;
    return email.trim().toLowerCase();
}

/**
 * Synchronous check used by existing UI code paths.
 * Returns true only when `refreshManagerStatusForUser` has confirmed the role.
 */
export function isManagerPlanUser(email: string | undefined | null): boolean {
    const normalized = normalize(email);
    if (!normalized) return false;
    return managerEmailCache.has(normalized);
}

export const hasManagerPlanFeatures = isManagerPlanUser;

/**
 * Read the user's current role directly from Supabase. This is the
 * authoritative async check used by route guards and navigation.
 */
export async function hasManagerAccess(userId: string): Promise<boolean> {
    if (!userId) return false;

    const currentEmail = normalize((await supabase.auth.getUser()).data.user?.email);
    if (currentEmail && legacyTechEmails.has(currentEmail)) {
        managerEmailCache.add(currentEmail);
        checkedEmailCache.add(currentEmail);
        return true;
    }

    const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    if (error || !data) return false;

    const hasAccess = data.role === 'manager' || data.role === 'admin';
    const email = currentEmail;
    if (email) {
        checkedEmailCache.add(email);
        if (hasAccess) managerEmailCache.add(email);
        else managerEmailCache.delete(email);
    }

    return hasAccess;
}

export function getManagerPlanName(): string {
    return 'Manager';
}

/**
 * Populate the cache for a given user. Call this from AuthContext as soon as
 * we know the authenticated user. Cheap network call; result is cached.
 */
export async function refreshManagerStatusForUser(
    userId: string,
    email: string | undefined | null
): Promise<boolean> {
    const normalized = normalize(email);
    if (!normalized || !userId) return false;

    if (legacyTechEmails.has(normalized)) {
        managerEmailCache.add(normalized);
        checkedEmailCache.add(normalized);
        return true;
    }

    if (checkedEmailCache.has(normalized)) {
        return managerEmailCache.has(normalized);
    }

    const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    checkedEmailCache.add(normalized);

    if (error || !data) {
        return false;
    }

    if (data.role === 'manager' || data.role === 'admin') {
        managerEmailCache.add(normalized);
        return true;
    }

    managerEmailCache.delete(normalized);
    return false;
}

/**
 * Test/admin helpers
 */
export function _setManagerStatus(email: string, isManager: boolean) {
    const normalized = normalize(email);
    if (!normalized) return;
    if (isManager) managerEmailCache.add(normalized);
    else managerEmailCache.delete(normalized);
    checkedEmailCache.add(normalized);
}

export function _clearManagerCache() {
    managerEmailCache.clear();
    checkedEmailCache.clear();
}
