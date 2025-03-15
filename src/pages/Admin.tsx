
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User, Bay } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { 
  UserCog, 
  ParkingSquare, 
  CalendarClock, 
  MegaphoneIcon,
  BookOpenText,
  ChevronRight
} from 'lucide-react';

const Admin = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    userCount: 0,
    bayCount: 0,
    assignmentCount: 0,
    claimCount: 0
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      // Fetch users count
      const { count: userCount, error: userError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      if (userError) throw userError;
      
      // Fetch bays count
      const { count: bayCount, error: bayError } = await supabase
        .from('bays')
        .select('*', { count: 'exact', head: true });
      
      if (bayError) throw bayError;
      
      // Fetch assignments count
      const { count: assignmentCount, error: assignmentError } = await supabase
        .from('permanent_assignments')
        .select('*', { count: 'exact', head: true });
      
      if (assignmentError) throw assignmentError;
      
      // Fetch claims count
      const { count: claimCount, error: claimError } = await supabase
        .from('daily_claims')
        .select('*', { count: 'exact', head: true });
      
      if (claimError) throw claimError;
      
      setStats({
        userCount: userCount || 0,
        bayCount: bayCount || 0,
        assignmentCount: assignmentCount || 0,
        claimCount: claimCount || 0
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admin statistics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.role !== 'Admin') {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Access Denied</h1>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              You do not have permission to access the admin dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.userCount}</div>
              <UserCog className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Bays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.bayCount}</div>
              <ParkingSquare className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Permanent Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.assignmentCount}</div>
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Daily Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{stats.claimCount}</div>
              <ParkingSquare className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Management</CardTitle>
            <CardDescription>Manage users, bays, and assignments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-between" asChild>
              <a href="/users">
                <span>User Management</span>
                <ChevronRight className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-between" asChild>
              <a href="/bays">
                <span>Bay Management</span>
                <ChevronRight className="h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-between">
              <span>Assignment Management</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Communications</CardTitle>
            <CardDescription>Create announcements and send notifications</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-between">
              <span>Create Announcement</span>
              <MegaphoneIcon className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between">
              <span>View Activity Logs</span>
              <BookOpenText className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
