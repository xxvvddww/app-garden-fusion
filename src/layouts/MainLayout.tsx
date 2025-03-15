
import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { LucideCarFront, LucideMoon, LucideSun, LucideLogOut, LucideUser, LucidePanelLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const MainLayout = ({ children }: { children: ReactNode }) => {
  const { user, loading, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);

  useEffect(() => {
    // TODO: Check for unread announcements
    // This is just a placeholder for now
    setUnreadAnnouncements(0);
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate('/login');
  };

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const mainNavigationItems = user ? [
    { name: 'Dashboard', href: '/' },
    { name: 'Bays', href: '/bays' },
    { name: 'My Bay', href: '/my-bay' },
  ] : [];

  if (user?.role === 'Admin' || user?.role === 'Moderator') {
    mainNavigationItems.push(
      { name: 'Users', href: '/users' },
      { name: 'Assignments', href: '/assignments' }
    );
  }

  if (user?.role === 'Admin') {
    mainNavigationItems.push(
      { name: 'Audit Logs', href: '/audit-logs' },
      { name: 'Announcements', href: '/announcements' }
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </div>
        </header>
        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="grid gap-6">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  const navigationContent = (
    <div className={cn(
      "h-full flex flex-col",
      !isMobile && "w-64"
    )}>
      <div className="p-4 border-b border-border">
        {user ? (
          <div className="flex flex-col gap-2">
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground uppercase bg-secondary rounded-md px-2 py-1 inline-block w-fit">
              {user.role}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="font-medium">Welcome</p>
            <p className="text-sm text-muted-foreground">Please sign in</p>
          </div>
        )}
      </div>
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {mainNavigationItems.map((item) => (
            <li key={item.name}>
              <Link
                to={item.href}
                className="block px-3 py-2 rounded-md hover:bg-secondary transition-colors"
                onClick={() => isMobile && setSidebarOpen(false)}
              >
                {item.name}
              </Link>
            </li>
          ))}
          
          {user && unreadAnnouncements > 0 && (
            <li>
              <Link
                to="/announcements"
                className="block px-3 py-2 rounded-md hover:bg-secondary transition-colors bg-primary/10 font-medium"
                onClick={() => isMobile && setSidebarOpen(false)}
              >
                Announcements
                <span className="ml-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  {unreadAnnouncements}
                </span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      <div className="p-4 border-t border-border">
        {user ? (
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            <LucideLogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
            <LucideUser className="mr-2 h-4 w-4" />
            Sign in
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon">
                    <LucidePanelLeft className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0">
                  {navigationContent}
                </SheetContent>
              </Sheet>
            )}
            <Link to="/" className="flex items-center gap-2 font-bold text-xl">
              <LucideCarFront className="h-6 w-6" />
              <span>Bay Manager</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleThemeToggle}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? (
                <LucideSun className="h-5 w-5" />
              ) : (
                <LucideMoon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {!isMobile && (
          <aside className="h-[calc(100vh-65px)] border-r border-border overflow-y-auto sticky top-[65px]">
            {navigationContent}
          </aside>
        )}
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
