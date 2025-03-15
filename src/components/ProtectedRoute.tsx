
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'Admin' | 'Moderator' | 'User';
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Check if user has specific role
    // For Admin role, only Admin can access
    // For Moderator role, both Admin and Moderator can access
    // For User role, any authenticated user can access
    if (
      requiredRole === 'Admin' && user.role !== 'Admin' ||
      requiredRole === 'Moderator' && user.role !== 'Admin' && user.role !== 'Moderator'
    ) {
      // Redirect to dashboard if doesn't have required role
      return <Navigate to="/" replace />;
    }
  }

  // Check if account is locked or suspended
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

  return <>{children}</>;
};

export default ProtectedRoute;
