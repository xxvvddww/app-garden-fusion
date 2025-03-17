
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase, refreshSession } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'Admin' | 'Moderator' | 'User';
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, session, loading, refreshUserData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Track whether initial auth check has completed
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshAttempts, setRefreshAttempts] = useState(0);

  useEffect(() => {
    console.log("ProtectedRoute - auth state:", { 
      hasUser: !!user, 
      hasSession: !!session, 
      loading, 
      currentPath: location.pathname,
      hasCheckedAuth,
      refreshAttempts
    });

    // Set hasCheckedAuth to true once loading is complete
    if (!loading && !hasCheckedAuth) {
      setHasCheckedAuth(true);
    }
  }, [user, session, loading, location, hasCheckedAuth, refreshAttempts]);

  // Force a session refresh on component mount
  useEffect(() => {
    const trySessionRefresh = async () => {
      if (!user && !loading && refreshAttempts < 3) {
        setIsRefreshing(true);
        try {
          console.log(`Attempting session refresh (attempt ${refreshAttempts + 1})`);
          await refreshSession();
          // After refreshing, update user data in Auth context
          if (refreshUserData) {
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
    
    if (hasCheckedAuth && !user && !loading) {
      trySessionRefresh();
    }
  }, [hasCheckedAuth, user, loading, refreshAttempts, refreshUserData]);

  // When returning from background on mobile, this helps re-validate auth status
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('App visible, rechecking auth state in ProtectedRoute');
        
        // First check if we already have a session
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          console.log("Session found on visibility change:", { 
            userId: data.session.user.id,
            hasAccessToken: !!data.session.access_token 
          });
          
          // If we have a session but no user data, force a refresh
          if (!user && refreshUserData) {
            console.log("We have a session but no user data, refreshing user data");
            await refreshUserData();
          }
        } else if (!user) {
          console.log("No session found on visibility change, redirecting to login");
          navigate('/login', { replace: true });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session, user, navigate, refreshUserData]);

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
