import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  unitNumber: string;
  whatsapp: string;
  inviteCode: string;
  termsAccepted: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setProfile(data as Profile);
        return;
      }

      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session?.user?.id, fetchProfile]);

  // 1. Escuchar cambios de sesión de forma SÍNCRONA (evita deadlocks de Supabase al cambiar de pestaña o presionar F5)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data: { session: current } }) => {
      if (!mounted) return;
      setSession(current);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
        setAuthReady(true);
        return;
      }
      setSession(newSession);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Cargar el perfil en un efecto separado cuando cambia el userId
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (!authReady) return;

    if (!userId) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let cancelled = false;
    setProfileLoading(true);

    fetchProfile(userId).finally(() => {
      if (!cancelled) {
        setProfileLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [authReady, userId, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async ({
    email,
    password,
    fullName,
    unitNumber,
    whatsapp,
    inviteCode,
    termsAccepted,
  }: SignUpParams) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          unit_number: unitNumber.trim(),
          whatsapp: whatsapp.trim(),
          invite_code: inviteCode.trim(),
          terms_accepted: termsAccepted ? 'true' : 'false',
        },
      },
    });
    if (error) throw error;
  };

  const requestPasswordReset = async (email: string) => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setIsPasswordRecovery(false);
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsPasswordRecovery(false);
    setProfile(null);
    setSession(null);
  };

  const loading = !authReady || (Boolean(userId) && !profile && profileLoading);

  return {
    session,
    profile,
    loading,
    isPasswordRecovery,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    clearPasswordRecovery,
    signOut,
    refreshProfile,
  };
}
