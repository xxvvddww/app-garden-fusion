
import { ReactNode, useEffect, useState, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase, refreshSession, hasPotentialSession, forceGetSession, resetSessionState } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'Admin' | 'Moderator' | 'User';
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, session, loading, refreshUserData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Track whether initial auth check has completed
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshAttempts, setRefreshAttempts] = useState(0);
  const [lastVisibleTime, setLastVisibleTime] = useState(Date.now());
  const mountTimeRef = useRef(Date.now());
  const sessionCheckIntervalRef = useRef<number | null>(null);
  const [sessionCheckCount, setSessionCheckCount] = useState(0);
  const [isResettingSession, setIsResettingSession] = useState(false);

  // Log current auth state for debugging
  useEffect(() => {
    console.log("ProtectedRoute - auth state:", { 
      hasUser: !!user, 
      hasSession: !!session, 
      loading, 
      currentPath: location.pathname,
      hasCheckedAuth,
      refreshAttempts,
      isRefreshing,
      mountTime: new Date(mountTimeRef.current).toISOString(),
      elapsedTime: Date.now() - mountTimeRef.current
    });

    // Set hasCheckedAuth to true once loading is complete
    if (!loading && !hasCheckedAuth) {
      setHasCheckedAuth(true);
    }
    
    return () => {
      // Clear intervals on unmount
      if (sessionCheckIntervalRef.current) {
        window.clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
    };
  }, [user, session, loading, location, hasCheckedAuth, refreshAttempts, isRefreshing]);

  // Setup periodic session checks if needed
  useEffect(() => {
    // Set up interval to periodically check session if no user but potential session exists
    if (hasCheckedAuth && !user && !loading && hasPotentialSession() && !sessionCheckIntervalRef.current) {
      console.log("Setting up periodic session checks in ProtectedRoute");
      
      sessionCheckIntervalRef.current = window.setInterval(() => {
        if (!user && !isRefreshing && hasPotentialSession()) {
          setSessionCheckCount(prev => prev + 1);
        } else if (user) {
          // Clear interval if we have a user
          if (sessionCheckIntervalRef.current) {
            window.clearInterval(sessionCheckIntervalRef.current);
            sessionCheckIntervalRef.current = null;
          }
        }
      }, 2000);
    }
    
    return () => {
      if (sessionCheckIntervalRef.current) {
        window.clearInterval(sessionCheckIntervalRef.current);
        sessionCheckIntervalRef.current = null;
      }
    };
  }, [hasCheckedAuth, user, loading, isRefreshing]);
  
  // Perform periodic session checks
  useEffect(() => {
    const performSessionCheck = async () => {
      if (sessionCheckCount > 0 && !user && !isRefreshing && !loading && hasPotentialSession()) {
        console.log(`Performing periodic session check #${sessionCheckCount} in ProtectedRoute`);
        setIsRefreshing(true);
        
        try {
          const { data } = await forceGetSession();
          console.log("Periodic session check result:", {
            hasSession: !!data.session,
            sessionUser: data.session?.user?.id
          });
          
          if (data.session && refreshUserData) {
            console.log("Session found, refreshing user data");
            await refreshUserData();
          }
        } catch (error) {
          console.error("Error in periodic session check:", error);
        } finally {
          setIsRefreshing(false);
        }
      }
    };
    
    performSessionCheck();
  }, [sessionCheckCount, user, isRefreshing, loading, refreshUserData]);

  // Immediately try to refresh session on mount if there might be a valid session
  useEffect(() => {
    const trySessionRefresh = async () => {
      if (!user && !loading && refreshAttempts < 3 && hasPotentialSession()) {
        setIsRefreshing(true);
        try {
          console.log(`Attempting session refresh on ProtectedRoute mount (attempt ${refreshAttempts + 1})`);
          
          // Use forceGetSession for more reliable session checks
          const result = await forceGetSession();
          console.log("Force get session result:", {
            hasSession: !!result.data.session,
            hasError: !!result.error
          });
          
          // After refreshing, update user data in Auth context
          if (result.data.session && refreshUserData) {
            console.log("Refreshing user data after session check");
            await refreshUserData();
          }
        } catch (error) {
          console.error("Error during forced session refresh:", error);
        } finally {
          setIsRefreshing(false);
          setRefreshAttempts(prev => prev + 1);
        }
      }
    };
    
    if (hasCheckedAuth && !user && !loading && !isRefreshing) {
      trySessionRefresh();
    }
  }, [hasCheckedAuth, user, loading, refreshAttempts, refreshUserData, isRefreshing]);

  // When returning from background on mobile, this helps re-validate auth status
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const timeSinceLastVisible = now - lastVisibleTime;
        setLastVisibleTime(now);
        
        console.log('App visible, rechecking auth state in ProtectedRoute', {
          timeSinceLastVisible,
          hasSession: !!session,
          hasUser: !!user
        });
        
        if (!user && !session && !loading && !isRefreshing && hasPotentialSession()) {
          setIsRefreshing(true);
          try {
            console.log("Attempting to refresh session on visibility change");
            
            // Always do a clean session check when returning from background
            const result = await forceGetSession();
            console.log("Force session check result on visibility change:", {
              hasSession: !!result.data.session
            });
            
            // If we have a session but no user data, force a refresh
            if (result.data.session && refreshUserData) {
              console.log("Refreshing user data after visibility change");
              await refreshUserData();
            }
            
            // If we still don't have a session after multiple attempts, show toast
            if (refreshAttempts >= 2 && !session && !user) {
              toast({
                title: "Session expired",
                description: "Please log in again to continue",
                variant: "destructive",
              });
              navigate('/login', { replace: true, state: { from: location } });
            }
          } catch (error) {
            console.error("Error refreshing session on visibility change:", error);
          } finally {
            setIsRefreshing(false);
          }
        } else if (!user && !session && timeSinceLastVisible > 5000) {
          console.log("No session potential on visibility change, redirecting to login");
          navigate('/login', { replace: true, state: { from: location } });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, user, navigate, refreshUserData, location, loading, isRefreshing, lastVisibleTime, refreshAttempts, toast]);

  // Handle complete session reset
  const handleResetSession = async () => {
    if (isResettingSession) return;
    
    setIsResettingSession(true);
    try {
      console.log("User requested complete session reset");
      toast({
        title: "Resetting session",
        description: "Please wait while we reset your session state..."
      });
      
      await resetSessionState();
      
      // Force redirect to login
      navigate('/login', { replace: true, state: { from: location } });
    } catch (error) {
      console.error("Error resetting session:", error);
      toast({
        title: "Error",
        description: "Failed to reset session state",
        variant: "destructive"
      });
    } finally {
      setIsResettingSession(false);
    }
  };

  // Show enhanced loading state when refreshing session
  if (loading || isRefreshing) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center space-x-2 mb-6">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-40 w-full" />
        
        {refreshAttempts > 1 && (
          <div className="flex flex-col items-center justify-center mt-8 space-y-2">
            <p className="text-muted-foreground text-sm">
              {isRefreshing ? "Checking session status..." : "Still loading..."}
            </p>
            {refreshAttempts >= 2 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleResetSession}
                disabled={isResettingSession}
              >
                {isResettingSession ? "Resetting..." : "Reset Session"}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // If after refresh attempts we still don't have a user, redirect to login
  if (!session || !user) {
    console.log("User not authenticated after refresh attempts, redirecting to login");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user has the required role
  if (requiredRole) {
    // For Admin role, only Admin can access
    // For Moderator role, both Admin and Moderator can access
    // For User role, any authenticated user can access
    if (
      (requiredRole === 'Admin' && user.role !== 'Admin') ||
      (requiredRole === 'Moderator' && user.role !== 'Admin' && user.role !== 'Moderator')
    ) {
      console.log("User doesn't have required role, redirecting to dashboard");
      // Redirect to dashboard if doesn't have required role
      return <Navigate to="/" replace />;
    }
  }

  // Check account status
  if (user.status === 'Locked' || user.status === 'Suspended') {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="bg-destructive/10 text-destructive p-6 rounded-lg max-w-md text-center">
          <h1 className="text-xl font-bold mb-4">Account {user.status.toLowerCase()}</h1>
          <p className="mb-4">
            {user.status === 'Locked'
              ? 'Your account has been locked due to multiple failed login attempts.'
              : 'Your account has been suspended. '}
            Please contact an administrator for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Check if account is active
  if (user.status !== 'Active') {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="bg-warning/10 text-warning p-6 rounded-lg max-w-md text-center">
          <h1 className="text-xl font-bold mb-4">Account not active</h1>
          <p className="mb-4">
            Your account is currently not active. Please contact an administrator for assistance.
          </p>
        </div>
      </div>
    );
  }

  // User is authenticated and has the required role/status
  console.log("User is authenticated with correct permissions, rendering protected content");
  return <>{children}</>;
};

export default ProtectedRoute;
