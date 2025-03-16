
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeProvider';
import { cn } from '@/lib/utils';
import { 
  SunMedium, 
  MoonStar, 
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user && user.role === 'Admin';
  const [hasAssignedBay, setHasAssignedBay] = useState(false);
  
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
        }
      }
    };
    
    checkUserAssignments();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // 3. Rearranged menu order: Bays, My Bay, Admin
  const navigationItems = [
    { path: "/bays", label: "Bays" },
  ];
  
  if (hasAssignedBay) {
    navigationItems.push({ 
      path: "/my-bay", 
      label: "My Bay"
    });
  }

  if (isAdmin) {
    navigationItems.push({ 
      path: "/admin", 
      label: "Admin"
    });
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="bg-slate-900 text-white py-2 px-4 flex items-center justify-between">
        <div className="flex items-center">
          <Link to="/bays" className="text-lg font-bold mr-6">
            Parking App
          </Link>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-slate-800"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? 
              <MoonStar className="h-5 w-5" /> : 
              <SunMedium className="h-5 w-5" />
            }
          </Button>
          
          {/* 5. Changed profile picture to logout icon */}
          <Button 
            variant="ghost" 
            size="icon"
            className="text-white hover:bg-slate-800"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="bg-slate-950 text-white border-b border-slate-800">
        <div className="container mx-auto px-4">
          <nav className="flex">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "px-4 py-3 flex items-center text-sm font-medium transition-colors",
                  location.pathname === item.path 
                    ? "border-b-2 border-primary text-white" 
                    : "text-slate-400 hover:text-white border-b-2 border-transparent"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <main className="flex-grow bg-slate-950 text-white overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
