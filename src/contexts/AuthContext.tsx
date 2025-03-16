import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types';
import { useToast } from '@/components/ui/use-toast';
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

// Use localStorage to improve mobile session restoration
const STORAGE_KEY = 'parking-app-user-data';
const LAST_AUTH_CHECK_KEY = 'parking-app-last-auth-check';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(() => {
    // Try to restore user from localStorage on initial load
    const storedUser = localStorage.getItem(STORAGE_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Save user to localStorage whenever it changes
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
      
      // Create a user record if it doesn't exist
      const { data: existingUsers, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId);
      
      if (queryError) {
        console.error('Error checking user profile:', queryError);
        toast({
          title: "Error",
          description: "Failed to fetch user profile. Please try logging in again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!existingUsers || existingUsers.length === 0) {
        console.log("No user profile found, creating one");
        
        // Get user metadata from auth
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (!authUser) {
          console.error("Auth user not found");
          setLoading(false);
          return;
        }
        
        // Create a new user record
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([{
            user_id: userId,
            email: authUser.email,
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
            role: 'User',
            status: 'Active'
          }])
          .select('*')
          .single();
          
        if (insertError) {
          console.error('Error creating user profile:', insertError);
          toast({
            title: "Error",
            description: "Failed to create user profile. Please try logging in again.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        
        console.log("User profile created:", newUser);
        setUser(newUser as User);
      } else {
        console.log("User profile found:", existingUsers[0]);
        setUser(existingUsers[0] as User);
      }
      
      // Store timestamp of successful auth check
      localStorage.setItem(LAST_AUTH_CHECK_KEY, Date.now().toString());
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching your profile.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("AuthProvider initialized");
    
    const initAuth = async () => {
      try {
        setLoading(true);
        // Get initial session
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
        
        // Set up auth state change listener
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
            // Clear stored data on sign out
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

    // Add visibility change listener for better mobile browser session restoration
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        // Check when we last successfully verified auth
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
            
            // If we have a valid session
            if (data.session) {
              console.log('Valid session found on visibility change');
              setSession(data.session);
              
              // Check if user data needs to be refreshed
              if (!user || user.user_id !== data.session.user.id) {
                await fetchUserProfile(data.session.user.id);
              } else {
                setLoading(false);
              }
              
              // Update last auth check timestamp
              localStorage.setItem(LAST_AUTH_CHECK_KEY, now.toString());
            } else if (session) {
              // We thought we had a session but it's invalid/expired
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
