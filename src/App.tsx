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

// Configure QueryClient with appropriate settings
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
    // Log external link opening for debugging
    console.log("Opening external link:", url);
    return originalOpen.call(this, url, target, features);
  };
}

// Determine the base URL for the router
// This helps the app work in both development and production/preview environments
const getBasename = () => {
  // Extract the basename from the current URL
  const urlPath = window.location.pathname;
  
  // Add detailed logging for basename determination
  console.log('📍 Determining basename with:', {
    urlPath,
    hostname: window.location.hostname,
    isPreviewEnvironment: window.location.hostname.includes('lovable.app') || 
      window.location.hostname.includes('lovableproject.com')
  });
  
  // Check if we're in a preview environment (lovable.app or similar domains)
  if (window.location.hostname.includes('lovable.app') || 
      window.location.hostname.includes('lovableproject.com')) {
    
    // For Lovable preview environments, use the correct base path
    // Extract the first part of the path if it exists
    const pathSegments = urlPath.split('/').filter(Boolean);
    console.log('🔍 Path segments after filtering:', pathSegments);
    
    if (pathSegments.length > 0) {
      const basename = `/${pathSegments[0]}`;
      console.log('✅ Using basename:', basename);
      return basename;
    }
    
    console.log('⚠️ No path segments found, using default basename');
  }
  
  // Default to no basename for local development
  console.log('✅ Using default basename: /');
  return '/';
};

const App = () => {
  const basename = getBasename();
  console.log('🧭 Router initialized with basename:', basename);
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ThemeContextProvider>
          <TooltipProvider>
            <AuthProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter basename={basename}>
                {/* Log when router is mounted */}
                {console.log('🚀 BrowserRouter mounted with basename:', basename)}
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
  );
};

export default App;
