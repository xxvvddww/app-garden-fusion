
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeProvider';
import { cn } from '@/lib/utils';
import { 
  SunMedium, 
  MoonStar, 
  LogOut,
  BellDot
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
import { Badge } from '@/components/ui/badge';
import { getBasename } from '@/utils/routing';

interface MainLayoutProps {
  children: React.ReactNode;
}

// Define a new interface for navigation items
interface NavigationItem {
  path: string;
  label: string;
  hasNotification?: boolean;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  console.log('⚡ MainLayout rendering');
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user && user.role === 'Admin';
  const [hasAssignedBay, setHasAssignedBay] = useState(false);
  const [hasUnreadAnnouncements, setHasUnreadAnnouncements] = useState(false);
  const basename = getBasename();
  
  console.log('MainLayout state:', { 
    user: user ? `ID: ${user.user_id}, Role: ${user.role}` : 'No user',
    theme,
    currentPath: location.pathname,
    hasAssignedBay,
    hasUnreadAnnouncements,
    basename
  });
  
  useEffect(() => {
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
        }
      }
    };
    
    checkUserAssignments();
  }, [user]);

  useEffect(() => {
    // Only check for unread announcements if the user is an admin
    const checkUnreadAnnouncements = async () => {
      if (user && isAdmin) {
        console.log('🔄 Checking for unread announcements');
        try {
          const { data, error } = await supabase
            .rpc('get_unread_announcements_for_user', { user_id_param: user.user_id });
            
          if (error) {
            console.error('❌ Error checking announcements:', error);
            throw error;
          }
          
          const hasUnread = data && data.length > 0;
          console.log('✅ Unread announcements result:', hasUnread, 'count:', data?.length);
          setHasUnreadAnnouncements(hasUnread);
        } catch (error) {
          console.error('❌ Error checking unread announcements:', error);
          setHasUnreadAnnouncements(false);
        }
      }
    };
    
    checkUnreadAnnouncements();
    
    // Set up real-time subscription for announcements if user is admin
    if (user && isAdmin) {
      console.log('🔔 Setting up announcements subscription');
      const channel = supabase
        .channel('public:announcements')
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'announcements' }, 
          (payload) => {
            console.log('🔔 New announcement received:', payload);
            checkUnreadAnnouncements();
          }
        )
        .subscribe();
        
      return () => {
        console.log('🧹 Cleaning up announcements subscription');
        supabase.removeChannel(channel);
      };
    }
  }, [user, isAdmin]);

  const handleSignOut = async () => {
    console.log('🔄 Signing out user');
    await signOut();
    const loginPath = `${basename}/login`;
    console.log(`🔄 Navigating to login: ${loginPath}`);
    navigate(loginPath);
  };

  // Update type of navigationItems to use the new interface
  const navigationItems: NavigationItem[] = [
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
      label: "Admin",
      hasNotification: hasUnreadAnnouncements
    });
  }

  console.log('Navigation items:', navigationItems);
  console.log('Current location:', location.pathname);
  
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
                  "px-4 py-3 flex items-center text-sm font-medium transition-colors relative group",
                  location.pathname === item.path 
                    ? "text-white" 
                    : "text-slate-400 hover:text-white"
                )}
              >
                <div className="flex items-center">
                  {item.label}
                  {item.path === "/admin" && hasUnreadAnnouncements && (
                    <Badge variant="destructive" className="ml-2 h-2 w-2 rounded-full p-0 flex items-center justify-center">
                      <span className="sr-only">Notifications</span>
                    </Badge>
                  )}
                </div>
                <span 
                  className={cn(
                    "absolute bottom-0 left-0 w-full h-0.5",
                    location.pathname === item.path 
                      ? "animate-flow" 
                      : "bg-transparent group-hover:bg-gradient-to-r group-hover:from-blue-500/30 group-hover:to-purple-500/30"
                  )}
                />
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <main className="flex-grow bg-slate-950 text-white overflow-y-auto p-6">
        {console.log('🔍 Rendering children in MainLayout')}
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
