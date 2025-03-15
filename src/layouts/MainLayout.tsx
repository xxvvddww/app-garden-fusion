
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink, navigationMenuTriggerStyle } from "@/components/ui/navigation-menu";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user && user.role === 'Admin';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navigationItems = [
    { path: "/", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4 mr-2" /> },
    { path: "/users", label: "Users", icon: <Users className="h-4 w-4 mr-2" /> },
    { path: "/bays", label: "Parking Bays", icon: <ParkingSquare className="h-4 w-4 mr-2" /> },
    { path: "/my-bay", label: "My Bay", icon: <ParkingSquare className="h-4 w-4 mr-2" /> },
  ];

  if (isAdmin) {
    navigationItems.push({ 
      path: "/admin", 
      label: "Admin Settings", 
      icon: <UserCog className="h-4 w-4 mr-2" /> 
    });
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center space-x-2">
            <Link to="/" className="text-lg font-semibold">
              Parking App
            </Link>
          </div>

          <NavigationMenu className="hidden md:flex">
            <NavigationMenuList>
              {navigationItems.map((item) => (
                <NavigationMenuItem key={item.path}>
                  <Link to={item.path}>
                    <NavigationMenuLink 
                      className={cn(
                        navigationMenuTriggerStyle(),
                        location.pathname === item.path && "bg-accent text-accent-foreground"
                      )}
                    >
                      <div className="flex items-center">
                        {item.icon}
                        {item.label}
                      </div>
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Tabs 
              defaultValue={location.pathname} 
              className="w-full overflow-x-auto"
              onValueChange={(value) => navigate(value)}
            >
              <TabsList className="w-full justify-start">
                {navigationItems.map((item) => (
                  <TabsTrigger 
                    key={item.path} 
                    value={item.path}
                    className="flex items-center"
                  >
                    {item.icon}
                    <span className="sr-only md:not-sr-only">{item.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          
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
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden border-b border-border p-1">
        <Tabs 
          defaultValue={location.pathname}
          className="w-full overflow-x-auto"
          onValueChange={(value) => navigate(value)}
        >
          <TabsList className="w-full grid grid-flow-col auto-cols-max gap-1">
            {navigationItems.map((item) => (
              <TabsTrigger 
                key={item.path} 
                value={item.path}
                className="flex items-center whitespace-nowrap"
              >
                {item.icon}
                <span>{item.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <main className="flex-grow p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
