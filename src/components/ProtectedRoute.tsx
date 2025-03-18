
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getBasename, isLovableEnvironment } from '@/utils/routing';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'User' | 'Admin';
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  console.log('⚡ ProtectedRoute rendering with requiredRole:', requiredRole);
  const { user, loading } = useAuth();
  const location = useLocation();
  const [redirectAttempts, setRedirectAttempts] = useState(0);
  const basename = getBasename();
  
  console.log('ProtectedRoute state:', {
    user: user ? `ID: ${user.user_id}, Role: ${user.role}` : 'No user',
    loading,
    pathname: location.pathname,
    redirectAttempts,
    basename
  });
  
  useEffect(() => {
    console.log('Checking auth state for redirect:', {
      user: user ? `ID: ${user.user_id}, Role: ${user.role}` : 'No user',
      loading,
      session: user ? 'Present' : null,
      redirectAttempts
    });
  }, [user, loading, redirectAttempts]);

  // For initial loading state, return nothing
  if (loading && redirectAttempts < 3) {
    console.log('⏳ Auth still loading, attempts:', redirectAttempts);
    
    // Set a timeout to increment redirect attempts to avoid infinite loading
    setTimeout(() => {
      setRedirectAttempts(prev => prev + 1);
    }, 1000);
    
    return <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-lg text-gray-300">Loading...</p>
        <p className="text-sm text-gray-400 mt-2">Checking authentication...</p>
      </div>
    </div>;
  }

  // Check if user exists and has required role
  if (!user) {
    console.log('❌ No user, redirecting to login');
    // User is not authenticated, redirect to login
    const loginPath = isLovableEnvironment() ? `${basename}/login` : '/login';
    console.log(`🔄 Redirecting to login at: ${loginPath}`);
    
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }
  
  // Check if user has required role
  if (requiredRole && user.role !== requiredRole) {
    console.log(`❌ User does not have required role: ${requiredRole}, redirecting to default page`);
    // User does not have required role, redirect to default page
    return <Navigate to="/" replace />;
  }

  // User is authenticated and has required role, render children
  console.log('✅ User authenticated and authorized, rendering protected content');
  return <>{children}</>;
};

export default ProtectedRoute;
