
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider, ThemeContextProvider } from "@/contexts/ThemeProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import MainLayout from "@/layouts/MainLayout";
import Login from "@/pages/Login";
import Bays from "@/pages/Bays";
import MyBay from "@/pages/MyBay";
import Admin from "@/pages/Admin";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getBasename, correctRoutePath, isLovableEnvironment } from "@/utils/routing";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
    },
  },
});

const DefaultRedirect = () => {
  console.log('⚡ DefaultRedirect component rendering');
  const { user } = useAuth();
  const [hasAssignedBay, setHasAssignedBay] = useState(false);
  const [loading, setLoading] = useState(true);
  
  console.log('DefaultRedirect state:', { 
    user: user ? `ID: ${user.user_id}` : 'No user', 
    hasAssignedBay, 
    loading 
  });
  
  useEffect(() => {
    console.log('⚡ DefaultRedirect useEffect triggered with user:', user ? `ID: ${user.user_id}` : 'No user');
    
    const checkUserAssignments = async () => {
      if (user) {
        console.log('🔄 Checking if user has assigned bays');
        try {
          const { data, error } = await supabase
            .from('permanent_assignments')
            .select('*')
            .eq('user_id', user.user_id)
            .limit(1);
            
          if (error) {
            console.error('❌ Error checking assignments:', error);
            throw error;
          }
          
          const hasAssignments = data && data.length > 0;
          console.log('✅ User assignments check result:', hasAssignments);
          setHasAssignedBay(hasAssignments);
        } catch (error) {
          console.error('❌ Error checking user bay assignments:', error);
          setHasAssignedBay(false);
        } finally {
          setLoading(false);
        }
      } else {
        console.log('⚠️ No user available, skipping assignments check');
        setLoading(false);
      }
    };
    
    checkUserAssignments();
  }, [user]);

  if (loading) {
    console.log('⏳ DefaultRedirect is loading, returning null');
    return null;
  }
  
  console.log('🔄 DefaultRedirect navigating to:', hasAssignedBay ? '/my-bay' : '/bays');
  
  if (hasAssignedBay) {
    return <Navigate to="/my-bay" replace />;
  }
  
  return <Navigate to="/bays" replace />;
};

const RouteCorrector = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  console.log('⚡ RouteCorrector rendering with path:', location.pathname);
  
  useEffect(() => {
    console.log('📍 RouteCorrector effect checking path:', location.pathname);
    console.log('📊 Current URL details:', {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      fullUrl: window.location.href
    });
    
    // Handle the special case for the root path in preview environments
    if (isLovableEnvironment() && (location.pathname === '/' || location.pathname === '')) {
      const basename = getBasename();
      console.log('🔍 Detected root path in preview environment with basename:', basename);
      
      if (basename !== '/') {
        console.log(`🔄 Redirecting from root to ${basename}/login in preview environment`);
        navigate(`${basename}/login`, { replace: true });
        return;
      }
    }
    
    const correctPath = correctRoutePath(location.pathname);
    if (correctPath) {
      console.log(`🔄 Correcting route from ${location.pathname} to ${correctPath}`);
      navigate(correctPath, { replace: true });
    } else {
      console.log('✅ Current route is correct, no redirection needed');
    }
  }, [location.pathname, navigate]);
  
  return <>{children}</>;
};

if (typeof window !== 'undefined') {
  const originalOpen = window.open;
  window.open = function(url, target, features) {
    console.log("Opening external link:", url);
    return originalOpen.call(this, url, target, features);
  };
}

const App = () => {
  console.log('⚡ App component rendering');
  const [loadError, setLoadError] = useState<Error | null>(null);
  const basename = getBasename();
  
  useEffect(() => {
    console.log('🚀 App component mounted');
    console.log('🧭 Using basename:', basename);
    
    console.log('📊 Environment information:', {
      basename,
      location: window.location.href,
      pathname: window.location.pathname,
      hostname: window.location.hostname,
      origin: window.location.origin,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
    
    // Additional check for preview environment root path
    if (isLovableEnvironment() && (window.location.pathname === '/' || window.location.pathname === '')) {
      console.log('🔍 Detected root path in preview environment');
      if (basename !== '/') {
        console.log(`⚠️ Root path should redirect to ${basename}/login`);
      }
    }
    
    const handleError = (event: ErrorEvent) => {
      console.error('🔥 Unhandled error:', event.error);
      setLoadError(event.error);
    };
    
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [basename]);
  
  if (loadError) {
    console.error('🔥 Rendering error state due to:', loadError);
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-lg shadow-xl p-6">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="mb-4 text-slate-300">
            We're having trouble loading the application. Please try refreshing the page.
          </p>
          <pre className="p-4 bg-slate-800 rounded text-xs overflow-auto mb-4">
            {loadError.message}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  console.log('🧭 App component setting up router with basename:', basename);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemeContextProvider>
            <TooltipProvider>
              <AuthProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter basename={basename}>
                  <RouteCorrector>
                    <Routes>
                      {console.log('📍 Setting up routes with basename:', basename)}
                      <Route path="/login" element={<Login />} />
                      
                      <Route
                        path="/"
                        element={
                          <ProtectedRoute>
                            <DefaultRedirect />
                          </ProtectedRoute>
                        }
                      />
                      
                      <Route
                        path="/bays"
                        element={
                          <ProtectedRoute>
                            <MainLayout>
                              <Bays />
                            </MainLayout>
                          </ProtectedRoute>
                        }
                      />
                      
                      <Route
                        path="/my-bay"
                        element={
                          <ProtectedRoute>
                            <MainLayout>
                              <MyBay />
                            </MainLayout>
                          </ProtectedRoute>
                        }
                      />
                      
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute requiredRole="Admin">
                            <MainLayout>
                              <Admin />
                            </MainLayout>
                          </ProtectedRoute>
                        }
                      />
                      
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </RouteCorrector>
                </BrowserRouter>
              </AuthProvider>
            </TooltipProvider>
          </ThemeContextProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
