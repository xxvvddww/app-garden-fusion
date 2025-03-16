import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase, refreshSession, hasPotentialSession, forceGetSession } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

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

  // Log current auth state for debugging
  useEffect(() => {
    console.log("ProtectedRoute - auth state:", { 
      hasUser: !!user, 
      hasSession: !!session, 
      loading, 
      currentPath: location.pathname,
      hasCheckedAuth,
      refreshAttempts,
      isRefreshing
    });

    // Set hasCheckedAuth to true once loading is complete
    if (!loading && !hasCheckedAuth) {
      setHasCheckedAuth(true);
    }
  }, [user, session, loading, location, hasCheckedAuth, refreshAttempts, isRefreshing]);

  // Immediately try to refresh session on mount if there might be a valid session
  useEffect(() => {
    const trySessionRefresh = async () => {
      if (!user && !loading && refreshAttempts < 3 && hasPotentialSession()) {
        setIsRefreshing(true);
        try {
          console.log(`Attempting session refresh on ProtectedRoute mount (attempt ${refreshAttempts + 1})`);
          
          // Use forceGetSession to do a clean check
          if (refreshAttempts > 0) {
            const result = await forceGetSession();
            console.log("Force get session result:", {
              hasSession: !!result.data.session,
              hasError: !!result.error
            });
          } else {
            const result = await refreshSession();
            console.log("Session refresh result:", {
              hasSession: !!result.data.session,
              hasError: !!result.error
            });
          }
          
          // After refreshing, update user data in Auth context
          if (refreshUserData) {
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
        
        // Only do a full refresh if we've been away for more than 5 seconds
        const shouldDoFullRefresh = timeSinceLastVisible > 5000;
        
        console.log('App visible, rechecking auth state in ProtectedRoute', {
          timeSinceLastVisible,
          shouldDoFullRefresh
        });
        
        if (!user && !session && !loading && !isRefreshing && hasPotentialSession()) {
          setIsRefreshing(true);
          try {
            console.log("Attempting to refresh session on visibility change");
            
            if (shouldDoFullRefresh) {
              // Do a clean session check if we've been away for a while
              const result = await forceGetSession();
              console.log("Force session check result:", {
                hasSession: !!result.data.session
              });
            } else {
              // Otherwise just do a normal refresh
              const result = await refreshSession();
              console.log("Session refresh result:", {
                hasSession: !!result.data.session
              });
            }
            
            // If we have a session but no user data, force a refresh
            if (refreshUserData) {
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
        } else if (!user && !session && shouldDoFullRefresh) {
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

  // Show enhanced loading state when refreshing session
  if (loading || isRefreshing) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
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
