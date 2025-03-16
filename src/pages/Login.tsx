
import { useState, useEffect, useRef } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { LucideCarFront } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import SignupForm from '@/components/SignupForm';
import { supabase, refreshSession, forceGetSession, hasPotentialSession } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
  const { user, session, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [redirectAttempts, setRedirectAttempts] = useState(0);
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);
  const [lastVisibleTime, setLastVisibleTime] = useState(Date.now());
  const [manualSessionCheck, setManualSessionCheck] = useState(0);
  const mountTimeRef = useRef(Date.now());
  const sessionCheckIntervalRef = useRef<number | null>(null);

  // Get the intended destination from location state, or default to '/'
  const from = location.state?.from?.pathname || '/';

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Log useful debug info on mount
  useEffect(() => {
    console.log("Login page mounted", {
      time: new Date().toISOString(),
      hasPotentialSession: hasPotentialSession(),
      hasSession: !!session,
      hasUser: !!user,
      isLoading: loading
    });
    
    return () => {
      console.log("Login page unmounted", {
        time: new Date().toISOString(),
        mountDuration: Date.now() - mountTimeRef.current,
        hasSession: !!session,
        hasUser: !!user
      });
      
      // Clear any intervals when unmounting
      if (sessionCheckIntervalRef.current) {
        window.clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, []);

  // Try to refresh session when component mounts if there might be a session
  useEffect(() => {
    const trySessionRefresh = async () => {
      // Only try to refresh if we don't already have a user
      if (!user && !loading && !isRefreshingSession) {
        console.log("Login page attempting session refresh on mount");
        setIsRefreshingSession(true);
        
        try {
          // Always force a clean session check on component mount
          const { data } = await forceGetSession();
          console.log("Mount session check result:", {
            hasSession: !!data.session,
            sessionUser: data.session?.user?.id
          });
          
          // If we got a session but still don't have a user, try a second check after a short delay
          if (data.session && !user) {
            setTimeout(async () => {
              console.log("Performing secondary session check");
              await forceGetSession();
            }, 500);
          }
        } catch (error) {
          console.error("Error refreshing session on login page mount:", error);
        } finally {
          setIsRefreshingSession(false);
        }
      }
    };
    
    // Always try a session refresh on mount
    trySessionRefresh();
    
    // Set up a repeating interval to check session status if we don't have a user yet
    // but potential session exists
    if (!user && hasPotentialSession() && !sessionCheckIntervalRef.current) {
      sessionCheckIntervalRef.current = window.setInterval(() => {
        if (!user && !isRefreshingSession) {
          setManualSessionCheck(prev => prev + 1);
        } else if (user) {
          // If we have a user, clear the interval
          if (sessionCheckIntervalRef.current) {
            window.clearInterval(sessionCheckIntervalRef.current);
            sessionCheckIntervalRef.current = null;
          }
        }
      }, 2000); // Check every 2 seconds
    }
    
    return () => {
      if (sessionCheckIntervalRef.current) {
        window.clearInterval(sessionCheckIntervalRef.current);
      }
    };
  }, [user, loading]);

  // Trigger a session refresh when manualSessionCheck changes
  useEffect(() => {
    const performManualSessionCheck = async () => {
      if (manualSessionCheck > 0 && !user && !isRefreshingSession) {
        console.log(`Performing manual session check #${manualSessionCheck}`);
        setIsRefreshingSession(true);
        try {
          const { data } = await forceGetSession();
          console.log("Manual session check result:", {
            hasSession: !!data.session,
            sessionUser: data.session?.user?.id
          });
        } catch (error) {
          console.error("Error in manual session check:", error);
        } finally {
          setIsRefreshingSession(false);
        }
      }
    };
    
    performManualSessionCheck();
  }, [manualSessionCheck, user, isRefreshingSession]);

  // Effect for redirection logic
  useEffect(() => {
    const redirectIfAuthenticated = () => {
      console.log("Checking auth state for redirect:", { 
        user, 
        loading, 
        session, 
        redirectAttempts,
        isRefreshingSession,
        manualSessionCheck
      });
      
      if (!loading && !isRefreshingSession) {
        if (user && session) {
          console.log("User is authenticated, redirecting to:", from);
          navigate(from, { replace: true });
        } else if (redirectAttempts < 5 && session && !user) {
          // If we have a session but no user yet, wait a bit and retry
          console.log("Session exists but no user yet, waiting...");
          setTimeout(() => {
            setRedirectAttempts(prev => prev + 1);
          }, 500);
        }
      }
    };
    
    redirectIfAuthenticated();
  }, [user, loading, session, navigate, from, redirectAttempts, isRefreshingSession, manualSessionCheck]);

  // Handle visibility change to refresh session when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const timeSinceLastVisible = now - lastVisibleTime;
        setLastVisibleTime(now);
        
        console.log("Login page visible, checking for session", {
          timeSinceLastVisible,
          hasUser: !!user,
          hasSession: !!session
        });
        
        // Always do a full session refresh when returning to the page
        if (!user && !loading && !isRefreshingSession) {
          setIsRefreshingSession(true);
          try {
            // Always use forceGetSession for visibility changes
            const { data } = await forceGetSession();
            console.log("Visibility change session check result:", {
              hasSession: !!data.session,
              sessionUser: data.session?.user?.id
            });
          } catch (error) {
            console.error("Error refreshing session on visibility change:", error);
          } finally {
            setIsRefreshingSession(false);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, loading, lastVisibleTime]);

  const onSubmit = async (values: LoginFormValues) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      console.log("Attempting to sign in with:", values.email);
      const { error } = await signIn(values.email, values.password);
      
      if (error) {
        console.error("Sign in failed:", error);
        toast({
          title: 'Sign in failed',
          description: error,
          variant: 'destructive',
        });
      } else {
        console.log("Sign in successful, toast notification shown");
        toast({
          title: 'Welcome back',
          description: 'You have been signed in successfully.',
        });
        // The redirect will be handled by the useEffect
      }
    } catch (err) {
      console.error("Unexpected error during sign in:", err);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
  };

  // Manual session check button for debugging
  const handleManualCheck = async () => {
    if (isRefreshingSession) return;
    
    setIsRefreshingSession(true);
    try {
      console.log("Manual session check requested by user");
      const { data } = await forceGetSession();
      console.log("Manual check result:", {
        hasSession: !!data.session,
        sessionUser: data.session?.user?.id
      });
      
      if (data.session) {
        toast({
          title: 'Session found',
          description: 'Valid session detected. Attempting to restore.',
        });
      } else {
        toast({
          title: 'No session found',
          description: 'No valid session was found.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error("Error in manual session check:", error);
      toast({
        title: 'Session check failed',
        description: 'Error checking session status.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshingSession(false);
    }
  };

  // Immediate redirect if the user is already authenticated
  if (!loading && !isRefreshingSession && user && session) {
    console.log("User is already authenticated, redirecting immediately");
    return <Navigate to={from} replace />;
  }

  // Show loading state while authentication is being checked
  if (loading || isRefreshingSession) {
    console.log("Auth is loading, showing loading state");
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-2 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <LucideCarFront className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
            <CardTitle className="text-xl">Loading...</CardTitle>
            <CardDescription>Please wait while we authenticate you</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center mt-4">
              <Button 
                variant="outline" 
                onClick={handleManualCheck}
                disabled={isRefreshingSession}
              >
                Check Session Status
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <LucideCarFront className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-xl">
            {authMode === 'login' ? 'Sign in to Bay Manager' : 'Create a Bay Manager Account'}
          </CardTitle>
          <CardDescription>
            {authMode === 'login' 
              ? 'Enter your credentials to access your account' 
              : 'Fill in your details to create an account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authMode === 'login' ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="your.email@example.com"
                          autoComplete="email"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          autoComplete="current-password"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </Button>
                
                {hasPotentialSession() && !user && (
                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleManualCheck}
                      disabled={isRefreshingSession}
                    >
                      Check Session Status
                    </Button>
                  </div>
                )}
                
                <div className="text-center">
                  <Button type="button" variant="link" onClick={toggleAuthMode}>
                    Don't have an account? Sign up
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <SignupForm onToggleMode={toggleAuthMode} />
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            {authMode === 'login' 
              ? 'Contact an administrator for account assistance' 
              : 'By signing up, you agree to our terms of service'}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
