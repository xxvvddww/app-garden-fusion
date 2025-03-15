
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeProvider';
import { cn } from '@/lib/utils';
import { 
  SunMedium, 
  MoonStar, 
  Users, 
  ParkingSquare, 
  LogOut,
  UserCog
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { PermanentAssignment } from '@/types';

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
    // Check if user has any permanent bay assignments
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

  // Base navigation items
  const navigationItems = [
    { path: "/bays", label: "Parking Bays", icon: <ParkingSquare className="h-4 w-4" /> },
  ];
  
  // Add My Bay option only if user has permanent bay assignments
  if (hasAssignedBay) {
    navigationItems.push({ 
      path: "/my-bay", 
      label: "My Bay", 
      icon: <ParkingSquare className="h-4 w-4" /> 
    });
  }

  if (isAdmin) {
    // Add Users management for Admin at beginning
    navigationItems.unshift({ 
      path: "/users", 
      label: "Users", 
      icon: <Users className="h-4 w-4" /> 
    });
    
    // Add Admin settings after My Bay (if exists) or after Parking Bays if no My Bay
    navigationItems.push({ 
      path: "/admin", 
      label: "Admin Settings", 
      icon: <UserCog className="h-4 w-4" /> 
    });
  } else if (user && user.role === 'Moderator') {
    navigationItems.unshift({ 
      path: "/users", 
      label: "Users", 
      icon: <Users className="h-4 w-4" /> 
    });
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* App Header */}
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://github.com/shadcn.png" alt={user?.name || "Avatar"} />
                  <AvatarFallback>{user?.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Navigation Bar */}
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
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="flex-grow bg-slate-950 text-white overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
