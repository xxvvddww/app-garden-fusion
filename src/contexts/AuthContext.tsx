import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'parking-app-user-data';
const LAST_AUTH_CHECK_KEY = 'parking-app-last-auth-check';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem(STORAGE_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const fetchUserProfile = async (userId: string) => {
    try {
      setLoading(true);
      console.log("Fetching user profile for:", userId);
      
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        console.error("Auth user not found");
        setLoading(false);
        return;
      }

      console.log("Attempting to fetch user with standard query");
      const { data: existingUsers, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      console.log("Users query result:", { data: existingUsers, error: queryError });
      
      if (existingUsers) {
        console.log("User profile found:", existingUsers);
        setUser(existingUsers as User);
        setLoading(false);
        localStorage.setItem(LAST_AUTH_CHECK_KEY, Date.now().toString());
        return;
      }
      
      if (queryError) {
        console.error('Error checking user profile:', queryError);
        
        // Create a fallback user if needed - explicitly set to 'User' role and 'Pending' status
        const minimumUserData: User = {
          user_id: userId,
          email: authUser.email || '',
          name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
          role: 'User', // Always default to User role
          status: 'Pending', // Always default to Pending status
          created_by: null,
          created_date: null,
          mobile_number: authUser.user_metadata?.mobile_number || null,
          tsa_id: authUser.user_metadata?.tsa_id || null,
          updated_by: null,
          updated_date: null
        };
        
        console.log("Created fallback user profile:", minimumUserData);
        
        // Try to insert this user record
        const { error: insertError } = await supabase
          .from('users')
          .insert([minimumUserData]);
          
        if (insertError) {
          console.error('Error inserting fallback user:', insertError);
        } else {
          console.log("Inserted fallback user successfully");
        }
        
        setUser(minimumUserData);
        setLoading(false);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimumUserData));
        localStorage.setItem(LAST_AUTH_CHECK_KEY, Date.now().toString());
        return;
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("AuthProvider initialized");
    
    const initAuth = async () => {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("Initial session fetched:", sessionData.session ? {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email,
          hasAccessToken: !!sessionData.session.access_token,
          accessTokenExpiresAt: sessionData.session.expires_at 
            ? new Date(sessionData.session.expires_at * 1000).toISOString() 
            : 'unknown'
        } : 'No session');
        
        setSession(sessionData.session);
        
        if (sessionData.session) {
          await fetchUserProfile(sessionData.session.user.id);
        } else {
          setLoading(false);
        }
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          console.log("Auth state changed:", event, newSession ? {
            id: newSession.user.id,
            email: newSession.user.email,
            hasAccessToken: !!newSession.access_token,
            accessTokenPreview: newSession.access_token ? 
              newSession.access_token.substring(0, 10) + '...' : 'none'
          } : 'No session');
          
          setSession(newSession);
          
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            if (newSession) {
              await fetchUserProfile(newSession.user.id);
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setLoading(false);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(LAST_AUTH_CHECK_KEY);
          }
        });
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error("Error in auth initialization:", error);
        setLoading(false);
      }
    };
    
    initAuth();

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const lastAuthCheck = localStorage.getItem(LAST_AUTH_CHECK_KEY);
        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);
        const shouldCheckAuth = !lastAuthCheck || parseInt(lastAuthCheck) < fiveMinutesAgo;
        
        console.log('App became visible, refreshing auth state', {
          shouldCheckAuth,
          lastCheck: lastAuthCheck ? new Date(parseInt(lastAuthCheck)).toISOString() : 'never'
        });

        if (shouldCheckAuth) {
          try {
            setLoading(true);
            const { data } = await supabase.auth.getSession();
            
            if (data.session) {
              console.log('Valid session found on visibility change');
              setSession(data.session);
              
              if (!user || user.user_id !== data.session.user.id) {
                await fetchUserProfile(data.session.user.id);
              } else {
                setLoading(false);
              }
              
              localStorage.setItem(LAST_AUTH_CHECK_KEY, now.toString());
            } else if (session) {
              console.log('Session invalid on visibility change');
              setSession(null);
              setUser(null);
              setLoading(false);
            } else {
              setLoading(false);
            }
          } catch (error) {
            console.error('Error checking session on visibility change:', error);
            setLoading(false);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [toast]);

  const refreshUserData = async () => {
    if (session) {
      await fetchUserProfile(session.user.id);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log("Signing in with email:", email);
      setLoading(true);
      
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error("Sign in error:", error.message);
        setLoading(false);
        return { error: error.message };
      }
      
      console.log("Sign in successful");
      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false);
      return { error: 'An unexpected error occurred' };
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LAST_AUTH_CHECK_KEY);
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const value = {
    session,
    user,
    loading,
    signIn,
    signOut,
    refreshUserData
  };
  
  console.log("Auth context value:", {
    hasSession: !!session,
    hasUser: !!user,
    userRole: user?.role,
    loading
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
