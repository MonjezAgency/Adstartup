import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, Profile, Subscription, Brief, UserState, MetaConnection } from '../lib/supabase';
import { PRODUCTION_DOMAIN } from '../lib/domainValidation';
import { refreshManagerStatusForUser } from '../lib/managerPlanService';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  subscription: Subscription | null;
  brief: Brief | null;
  userState: UserState | null;
  metaConnection: MetaConnection | null;
  session: Session | null;
  loading: boolean;
  isSubscribed: boolean;
  hasBrief: boolean;
  isMetaConnected: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, phoneNumber: string, country: string) => Promise<{ error: Error | null; data?: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  refreshUserState: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  refreshBrief: () => Promise<void>;
  refreshMetaConnection: () => Promise<void>;
  countryCode?: string;
  trialExpired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [userState, setUserState] = useState<UserState | null>(null);
  const [metaConnection, setMetaConnection] = useState<MetaConnection | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [hasBrief, setHasBrief] = useState(false);
  const [isMetaConnected, setIsMetaConnected] = useState(false);
  const [countryCode, setCountryCode] = useState('US');
  const [trialExpired, setTrialExpired] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
        const userCountry = session.user.user_metadata?.country || 'US';
        setCountryCode(userCountry);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const userCountry = session.user.user_metadata?.country || 'US';
        setCountryCode(userCountry);

        // Handle OAuth sign-in/sign-up webhooks
        if (event === 'SIGNED_IN' && session.user.app_metadata?.provider === 'google') {
          try {
            await fetch('https://n8n.srv1181726.hstgr.cloud/webhook/Sign-in', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'user_signed_in',
                user_id: session.user.id,
                email: session.user.email,
                provider: 'google',
                timestamp: new Date().toISOString(),
              }),
            });
          } catch (webhookError) {
            console.error('[Google SignIn] Webhook error:', webhookError);
          }
        }

        loadUserData(session.user.id);
      } else {
        setProfile(null);
        setSubscription(null);
        setBrief(null);
        setUserState(null);
        setMetaConnection(null);
        setIsSubscribed(false);
        setHasBrief(false);
        setIsMetaConnected(false);
        setHasBrief(false);
        setIsMetaConnected(false);
        setCountryCode('US');
        setTrialExpired(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      const currentEmail = (await supabase.auth.getUser()).data.user?.email ?? null;
      await Promise.all([
        loadProfile(userId),
        loadUserState(userId),
        loadSubscription(userId),
        loadBrief(userId),
        loadMetaConnection(userId),
        refreshManagerStatusForUser(userId, currentEmail),
      ]);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadUserState = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_states')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setUserState(data);
    } catch (error) {
      console.error('Error loading user state:', error);
    }
  };

  const loadSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('trial_start_at, trial_end_at, trial_expired')
        .eq('id', userId)
        .maybeSingle();

      if (userError && userError.code !== 'PGRST116') throw userError;

      const hasActiveTrial = userData &&
        userData.trial_end_at &&
        !userData.trial_expired &&
        new Date(userData.trial_end_at) > new Date();

      setSubscription(data);
      setIsSubscribed(!!data || !!hasActiveTrial);
      setTrialExpired(!!userData?.trial_expired);
    } catch (error) {
      console.error('Error loading subscription:', error);
      setIsSubscribed(false);
      setTrialExpired(false);
    }
  };

  const loadBrief = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('campaign_briefs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setBrief(data);
      setHasBrief(!!data);
    } catch (error) {
      console.error('Error loading brief:', error);
      setHasBrief(false);
    }
  };

  const loadMetaConnection = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('meta_connections')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      setMetaConnection(data);
      // Require ad_account_id to be considered fully connected for dashboard functionality
      setIsMetaConnected(!!(data?.is_connected && data?.ad_account_id));
    } catch (error) {
      console.error('Error loading meta connection:', error);
      setIsMetaConnected(false);
    }
  };

  const refreshUserState = async () => {
    if (user) await loadUserState(user.id);
  };

  const refreshSubscription = async () => {
    if (user) await loadSubscription(user.id);
  };

  const refreshBrief = async () => {
    if (user) await loadBrief(user.id);
  };

  const refreshMetaConnection = async () => {
    if (user) await loadMetaConnection(user.id);
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('verified')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!data.user.email_confirmed_at) {
          await supabase.auth.signOut();
          throw new Error('Your email is not confirmed yet. Check your inbox, then use Resend confirmation email.');
        }

        // Supabase Auth is authoritative. Older accounts can still have
        // users.verified=false after clicking the confirmation link.
        if (userData && !userData.verified) {
          await supabase
            .from('users')
            .update({ verified: true, updated_at: new Date().toISOString() })
            .eq('id', data.user.id);
        }
      }

      try {
        await fetch('https://n8n.srv1181726.hstgr.cloud/webhook/Sign-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'user_signed_in',
            user_id: data.user.id,
            email: data.user.email,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (webhookError) {
        console.error('[SignIn] Webhook error:', webhookError);
      }

      console.log('[SignIn] Success - email confirmed at:', data.user?.email_confirmed_at);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const redirectTo = `${PRODUCTION_DOMAIN}/auth/confirm?source=google`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
        },
      });

      if (error) throw error;

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phoneNumber: string, country: string) => {
    try {
      console.log('[SignUp] Starting signup process');
      console.log('[SignUp] Input validation:', {
        email: !!email,
        password: !!password,
        fullName: !!fullName,
        phoneNumber: !!phoneNumber,
        country: !!country
      });

      const emailRedirectTo = `${window.location.origin}/auth/verified`;

      console.log('[SignUp] Step 1: Creating Supabase Auth user...');
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: fullName || 'User',
            phone_number: phoneNumber || '',
            country: country || 'US', // Store country code
          },
        },
      });

      if (signUpError) { return { error: signUpError, data: null }; }

      if (!authData.user) {
        throw new Error('Signup failed - no user returned from auth');
      }

      const userId = authData.user.id;
      console.log('[SignUp] Step 1: SUCCESS - Auth user created:', userId);
      console.log('[SignUp] Step 2: Trigger will auto-create user record (verified=false)...');

      // Wait a bit for trigger to execute
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify user was created by trigger (non-critical)
      console.log('[SignUp] Step 3: Verifying database user creation...');
      try {
        const { data: dbUser } = await supabase
          .from('users')
          .select('id, email, verified')
          .eq('id', userId)
          .maybeSingle();

        if (dbUser) {
          console.log('[SignUp] Step 3: SUCCESS - User found in database:', {
            id: dbUser.id,
            email: dbUser.email,
            verified: dbUser.verified,
          });
        } else {
          console.warn('[SignUp] Step 3: WARNING - User not yet in database (trigger still executing)');
        }
      } catch (checkError) {
        console.warn('[SignUp] Step 3: WARNING - Could not verify user in database (non-critical):', checkError);
      }

      if (!authData.user) return { error: new Error('No auth user'), data: null };

      // Fallback: Manually insert into public.users if trigger failed
      try {
        const { data: dbUserCheck } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (!dbUserCheck) {
          console.log('[SignUp] Step 3.5: Trigger likely failed. Manually inserting into public.users...');
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: userId,
              email: email,
              full_name: fullName || 'User', // Ensure partial profile data is present
              country: country || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('[SignUp] Step 3.5: Failed to manually insert user:', insertError);
          } else {
            console.log('[SignUp] Step 3.5: Manual insert successful.');
          }
        }
      } catch (fallbackError) {
        console.error('[SignUp] Step 3.5: Fallback insert crashed:', fallbackError);
      }

      // Create profile (non-critical)
      console.log('[SignUp] Step 4: Creating profile...');
      try {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (!existingProfile) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              full_name: fullName || 'User',
              phone_number: phoneNumber || '',
            });

          if (profileError) {
            if (profileError.code === '23505') {
              console.log('[SignUp] Step 4: Profile already exists - skipping');
            } else {
              console.warn('[SignUp] Step 4: Profile creation warning (non-critical):', {
                code: profileError.code,
                message: profileError.message,
              });
            }
          } else {
            console.log('[SignUp] Step 4: Profile created successfully');
          }
        } else {
          console.log('[SignUp] Step 4: Profile already exists - skipping');
        }
      } catch (profileCheckError) {
        console.warn('[SignUp] Step 4: WARNING - Could not manage profile (non-critical):', profileCheckError);
      }

      // Send webhook notification AND create user via server-side (bypasses RLS)
      console.log('[SignUp] Step 5: Sending webhook to create user in database...');
      try {
        const webhookResponse = await fetch('https://n8n.srv1181726.hstgr.cloud/webhook/Sign-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'user_signed_up',
            user_id: userId,
            email,
            fullName: fullName || 'User',
            phoneNumber: phoneNumber || '',
            country: country || 'US',
            timestamp: new Date().toISOString(),
            // CRITICAL: Tell n8n to create the user in public.users table
            create_user_in_db: true,
          }),
        });

        if (webhookResponse.ok) {
          const responseData = await webhookResponse.json().catch(() => ({}));
          console.log('[SignUp] Step 5: Webhook response:', responseData);

          if (responseData.user_created) {
            console.log('[SignUp] Step 5: User created successfully via webhook');
          } else {
            console.warn('[SignUp] Step 5: Webhook did not confirm user creation');
          }
        } else {
          console.error('[SignUp] Step 5: Webhook failed with status:', webhookResponse.status);
        }
      } catch (webhookError) {
        console.error('[SignUp] Step 5: Webhook error:', webhookError);
      }

      // Final verification: Wait and check if user exists now
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const { data: finalCheck } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .maybeSingle();

        if (finalCheck) {
          console.log('[SignUp] VERIFIED: User exists in database');
        } else {
          console.error('[SignUp] CRITICAL: User still not in database after all attempts!');
        }
      } catch (e) {
        console.error('[SignUp] Final check failed:', e);
      }

      console.log('[SignUp] COMPLETE: Signup successful');
      console.log('[SignUp] IMPORTANT: Verification email sent - user must verify email to sign in');

      return { error: null, data: authData };
    } catch (error: any) {
      console.error('[SignUp] FAILED: Signup process failed', {
        errorType: error?.name,
        errorCode: error?.code,
        errorMessage: error?.message,
        fullError: error,
      });

      return { error: error as Error, data: null };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    try {
      const redirectTo = `${PRODUCTION_DOMAIN}/reset-password`;

      console.log('[ResetPassword] ✓ Using redirect URL:', redirectTo);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const value = {
    user,
    profile,
    subscription,
    brief,
    userState,
    metaConnection,
    session,
    loading,
    isSubscribed,
    hasBrief,
    isMetaConnected,
    countryCode, // Expose country code
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    resetPassword,
    refreshUserState,
    refreshSubscription,
    refreshBrief,
    refreshMetaConnection,
    trialExpired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
