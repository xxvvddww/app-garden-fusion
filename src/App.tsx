
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import { getBasename } from "@/utils/routing";
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
  const { user } = useAuth();
  const [hasAssignedBay, setHasAssignedBay] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkUserAssignments = async () => {
      if (user) {
        try {
          const { data, error } = await supabase
            .from('permanent_assignments')
            .select('*')
            .eq('user_id', user.user_id)
            .limit(1);
            
          if (error) throw error;
          setHasAssignedBay(data && data.length > 0);
        } catch (error) {
          console.error('Error checking user bay assignments:', error);
          setHasAssignedBay(false);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    
    checkUserAssignments();
  }, [user]);

  if (loading) return null;
  
  if (hasAssignedBay) {
    return <Navigate to="/my-bay" replace />;
  }
  
  return <Navigate to="/bays" replace />;
};

// Patch window.open to ensure it works properly
if (typeof window !== 'undefined') {
  const originalOpen = window.open;
  window.open = function(url, target, features) {
    console.log("Opening external link:", url);
    return originalOpen.call(this, url, target, features);
  };
}

const App = () => {
  const [loadError, setLoadError] = useState<Error | null>(null);
  const basename = getBasename();
  
  useEffect(() => {
    console.log('🚀 App component mounted');
    console.log('🧭 Using basename:', basename);
    
    // Log detailed environment information
    console.log('📊 Environment information:', {
      basename,
      location: window.location.href,
      pathname: window.location.pathname,
      hostname: window.location.hostname,
      origin: window.location.origin,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString()
    });
    
    // Add unhandled error logging
    const handleError = (event: ErrorEvent) => {
      console.error('🔥 Unhandled error:', event.error);
      setLoadError(event.error);
    };
    
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, [basename]);
  
  // If there's a critical error, show a user-friendly error message
  if (loadError) {
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
                  <Routes>
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
