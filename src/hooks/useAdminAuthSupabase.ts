import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export type AdminRole = 'super_admin' | 'content_moderator' | 'category_manager';

interface AdminAuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  roles: AdminRole[];
  loading: boolean;
  isSuperAdmin: boolean;
  isContentModerator: boolean;
  isCategoryManager: boolean;
  signOut: () => Promise<void>;
}

export function useAdminAuthSupabase(): AdminAuthState {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          // Defer role check to avoid blocking auth state updates
          setTimeout(() => {
            checkAdminRoles(currentSession.user.id);
          }, 0);
        } else {
          setRoles([]);
          setLoading(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        checkAdminRoles(existingSession.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRoles = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Error checking admin roles:', error);
        setRoles([]);
      } else {
        setRoles((data || []).map(r => r.role as AdminRole));
      }
    } catch (err) {
      console.error('Error in admin auth check:', err);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRoles([]);
  };

  return {
    user,
    session,
    isAdmin: roles.length > 0,
    roles,
    loading,
    isSuperAdmin: roles.includes('super_admin'),
    isContentModerator: roles.includes('content_moderator') || roles.includes('super_admin'),
    isCategoryManager: roles.includes('category_manager') || roles.includes('super_admin'),
    signOut,
  };
}
