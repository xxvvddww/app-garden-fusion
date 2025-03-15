
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
import Users from "@/pages/Users";
import Bays from "@/pages/Bays";
import MyBay from "@/pages/MyBay";
import Admin from "@/pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
                
                {/* Redirect root to my-bay */}
                <Route
                  path="/"
                  element={<Navigate to="/my-bay" replace />}
                />

                <Route
                  path="/users"
                  element={
                    <ProtectedRoute requiredRole="Moderator">
                      <MainLayout>
                        <Users />
                      </MainLayout>
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

export default App;
