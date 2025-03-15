
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider, ThemeContextProvider } from "@/contexts/ThemeProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import MainLayout from "@/layouts/MainLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
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
                
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <MainLayout>
                        <Dashboard />
                      </MainLayout>
                    </ProtectedRoute>
                  }
                />
                
                {/* Add more routes here */}
                
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
