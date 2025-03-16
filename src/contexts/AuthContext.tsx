
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    console.log("AuthProvider initialized");
    
    const initAuth = async () => {
      try {
        // Get initial session
        const { data: sessionData } = await supabase.auth.getSession();
        console.log("Initial session fetched:", sessionData.session ? {
          id: sessionData.session.user.id,
          email: sessionData.session.user.email,
          hasAccessToken: !!sessionData.session.access_token,
          accessTokenPreview: sessionData.session.access_token ? 
            sessionData.session.access_token.substring(0, 10) + '...' : 'none'
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
  }, []);

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
