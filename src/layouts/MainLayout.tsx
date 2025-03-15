
import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeProvider';
import { cn } from '@/lib/utils';
import { 
  SunMedium, 
  MoonStar, 
  LayoutDashboard, 
  Users, 
  ParkingSquare, 
  LogOut,
  UserCog,
  Menu
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
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar
} from "@/components/ui/sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

const AppSidebar = () => {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user && user.role === 'Admin';
  
  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="p-2">
          <Link to="/" className="flex items-center text-lg font-semibold text-sidebar-foreground">
            Parking App
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/"} tooltip="Dashboard">
                  <Link to="/">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/users"} tooltip="Users">
                  <Link to="/users">
                    <Users className="h-4 w-4" />
                    <span>Users</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/bays"} tooltip="Parking Bays">
                  <Link to="/bays">
                    <ParkingSquare className="h-4 w-4" />
                    <span>Parking Bays</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location.pathname === "/my-bay"} tooltip="My Bay">
                  <Link to="/my-bay">
                    <ParkingSquare className="h-4 w-4" />
                    <span>My Bay</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === "/admin"} tooltip="Admin Settings">
                    <Link to="/admin">
                      <UserCog className="h-4 w-4" />
                      <span>Admin Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

const MainLayout = ({ children }: MainLayoutProps) => {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toggleSidebar } = useSidebar();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-background">
        <AppSidebar />
        
        {/* Main Content */}
        <div className="flex flex-col flex-grow overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between h-16 px-4 border-b border-border">
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle Menu</span>
            </Button>
            <SidebarTrigger className="hidden md:flex" />
            
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
                {theme === "light" ? <MoonStar className="h-5 w-5" /> : <SunMedium className="h-5 w-5" />}
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

          {/* Content */}
          <main className="flex-grow p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
