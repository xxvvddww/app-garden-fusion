
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
import Users from "@/pages/Users";
import NotFound from "./pages/NotFound";
import { useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,  // Changed from cacheTime to gcTime
      retry: 2,
    },
  },
});

const DefaultRedirect = () => {
  const { user } = useAuth();
  
  // No longer need to check for assigned bay - always redirect to bays page
  console.log("DefaultRedirect: Redirecting user to bays page");
  return <Navigate to="/bays" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ThemeContextProvider>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
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

                <Route
                  path="/users"
                  element={
                    <ProtectedRoute requiredRole="Admin">
                      <MainLayout>
                        <Users />
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

export default App;
