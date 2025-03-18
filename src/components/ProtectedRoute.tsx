
import { ReactNode, useEffect, useState, useRef } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase, refreshSession } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'Admin' | 'Moderator' | 'User';
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, session, loading: authLoading, refreshUserData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Track whether initial auth check has completed
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshAttempts, setRefreshAttempts] = useState(0);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<number | null>(null);
  const recoveryTimeoutRef = useRef<number | null>(null);
  
  // Cleanup function to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (recoveryTimeoutRef.current) {
        window.clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, []);

  // Monitor auth state and set hasCheckedAuth once initial loading is complete
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    console.log("ProtectedRoute - auth state:", { 
      hasUser: !!user, 
      hasSession: !!session, 
      authLoading,
      loading,
      currentPath: location.pathname,
      hasCheckedAuth,
      refreshAttempts
    });

    // Set hasCheckedAuth to true once loading is complete
    if (!authLoading && !hasCheckedAuth && isMountedRef.current) {
      // Give a short delay before marking auth as checked to allow for session recovery
      recoveryTimeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          setHasCheckedAuth(true);
        }
      }, 1000);
    }
    
    // Update loading state based on auth loading and refresh state
    if (isMountedRef.current) {
      setLoading(authLoading || isRefreshing);
    }
  }, [user, session, authLoading, location, hasCheckedAuth, refreshAttempts, isRefreshing]);

  // Force a session refresh on component mount if needed
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    const trySessionRefresh = async () => {
      if (!isMountedRef.current) return;
      
      if (!user && !authLoading && refreshAttempts < 3) {
        setIsRefreshing(true);
        try {
          console.log(`Attempting session refresh (attempt ${refreshAttempts + 1})`);
          await refreshSession();
          
          // After refreshing, update user data in Auth context
          if (refreshUserData && isMountedRef.current) {
            await refreshUserData();
            
            // Add a small delay to ensure everything is updated
            timeoutRef.current = window.setTimeout(() => {
              if (isMountedRef.current) {
                setIsRefreshing(false);
              }
            }, 1000); // Increased delay to give more time for auth processing
          } else if (isMountedRef.current) {
            setIsRefreshing(false);
          }
        } catch (error) {
          console.error("Error during forced session refresh:", error);
          if (isMountedRef.current) {
            setIsRefreshing(false);
          }
        } finally {
          if (isMountedRef.current) {
            setRefreshAttempts(prev => prev + 1);
          }
        }
      } else if (isMountedRef.current && user) {
        // If we have a user, we don't need to refresh
        setIsRefreshing(false);
      }
    };
    
    if (hasCheckedAuth && !user && !authLoading) {
      trySessionRefresh();
    }
  }, [hasCheckedAuth, user, authLoading, refreshAttempts, refreshUserData]);

  // When returning from background on mobile, this helps re-validate auth status
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!isMountedRef.current) return;
      
      if (document.visibilityState === 'visible') {
        console.log('App visible, rechecking auth state in ProtectedRoute');
        
        if (isMountedRef.current) {
          setLoading(true);
        }
        
        try {
          // First check if we already have a session
          const { data } = await supabase.auth.getSession();
          
          if (!isMountedRef.current) return;
          
          if (data.session) {
            console.log("Session found on visibility change:", { 
              userId: data.session.user.id,
              hasAccessToken: !!data.session.access_token 
            });
            
            // If we have a session but no user data, force a refresh
            if (!user && refreshUserData && isMountedRef.current) {
              console.log("We have a session but no user data, refreshing user data");
              await refreshUserData();
              
              // Add a small delay to ensure everything is updated before continuing
              timeoutRef.current = window.setTimeout(() => {
                if (isMountedRef.current) {
                  setLoading(false);
                }
              }, 1000); // Increased delay
            } else if (isMountedRef.current) {
              setLoading(false);
            }
          } else if (!user && isMountedRef.current) {
            // Don't immediately redirect - give more time for session recovery
            timeoutRef.current = window.setTimeout(() => {
              if (isMountedRef.current && !user) {
                console.log("No session found after wait, redirecting to login");
                navigate('/login', { replace: true });
              }
            }, 2000); // Increased delay before redirecting
            
            setLoading(false);
          } else if (isMountedRef.current) {
            setLoading(false);
          }
        } catch (error) {
          console.error("Error checking auth on visibility change:", error);
          if (isMountedRef.current) {
            toast({
              title: "Authentication Error",
              description: "There was a problem verifying your session. Please refresh the page.",
              variant: "destructive"
            });
            setLoading(false);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, user, navigate, refreshUserData, toast]);

  // Handle manual refresh when requested by the user
  const handleManualRefresh = () => {
    window.location.reload();
  };

  // Show enhanced loading state when refreshing session
  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center space-x-2 mb-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
        
        <div className="flex justify-center mt-8">
          <Button 
            variant="outline" 
            onClick={handleManualRefresh} 
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  // If after refresh attempts we still don't have a user, redirect to login
  // But give more time before redirecting
  if (!session || !user) {
    // Wait longer before redirecting on initial page load
    if (refreshAttempts < 3) {
      return (
        <div className="container mx-auto p-4 space-y-6">
          <div className="flex items-center space-x-2 mb-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-64 w-full" />
          
          <div className="flex justify-center mt-8">
            <Button 
              variant="outline" 
              onClick={handleManualRefresh} 
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }
    
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

  // Check if account is pending approval
  if (user.status === 'Pending') {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="bg-warning/10 text-warning p-6 rounded-lg max-w-md text-center">
          <h1 className="text-xl font-bold mb-4">Account pending approval</h1>
          <p className="mb-4">
            Your account is currently pending administrator approval. You will be notified once your account has been approved.
          </p>
          <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // Check if account is rejected
  if (user.status === 'Rejected') {
    return (
      <div className="container mx-auto p-4 flex flex-col items-center justify-center min-h-[80vh]">
        <div className="bg-destructive/10 text-destructive p-6 rounded-lg max-w-md text-center">
          <h1 className="text-xl font-bold mb-4">Account registration rejected</h1>
          <p className="mb-4">
            Your account registration has been rejected. Please contact an administrator for more information.
          </p>
          <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}>
            Sign Out
          </Button>
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
          <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  // User is authenticated and has the required role/status
  console.log("User is authenticated with correct permissions, rendering protected content");
  return <>{children}</>;
};

export default ProtectedRoute;
