
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User, Bay } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    userCount: 0,
    bayCount: 0,
    assignmentCount: 0,
    claimCount: 0
  });
  const [openAssignmentDialog, setOpenAssignmentDialog] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [bays, setBays] = useState<Bay[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedBay, setSelectedBay] = useState<string | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<string | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

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

  // Navigation handlers
  const handleNavigateToUsers = () => navigate('/users');
  const handleNavigateToBays = () => navigate('/bays');
  
  const handleOpenAssignmentDialog = async () => {
    try {
      // Fetch users and bays for assignment
      const [usersResponse, baysResponse] = await Promise.all([
        supabase.from('users').select('*').order('name'),
        supabase.from('bays').select('*').order('bay_number')
      ]);
      
      if (usersResponse.error) throw usersResponse.error;
      if (baysResponse.error) throw baysResponse.error;
      
      setUsers(usersResponse.data || []);
      setBays(baysResponse.data || []);
      setOpenAssignmentDialog(true);
    } catch (error) {
      console.error('Error fetching data for assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users and bays data',
        variant: 'destructive',
      });
    }
  };
  
  const handleCreateAssignment = async () => {
    if (!selectedUser || !selectedBay || !dayOfWeek) {
      toast({
        title: 'Validation Error',
        description: 'Please select a user, bay, and day of the week',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setAssignmentLoading(true);
      
      // Check if assignment already exists
      const { data: existingAssignment, error: checkError } = await supabase
        .from('permanent_assignments')
        .select('*')
        .eq('user_id', selectedUser)
        .eq('bay_id', selectedBay)
        .eq('day_of_week', dayOfWeek)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existingAssignment) {
        toast({
          title: 'Assignment Exists',
          description: 'This assignment already exists',
          variant: 'destructive',
        });
        return;
      }
      
      // Create new assignment
      const { error } = await supabase
        .from('permanent_assignments')
        .insert({
          user_id: selectedUser,
          bay_id: selectedBay,
          day_of_week: dayOfWeek,
          created_by: user?.user_id
        });
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Permanent assignment created successfully',
      });
      
      // Refresh stats
      fetchStats();
      setOpenAssignmentDialog(false);
      
      // Reset form
      setSelectedUser(null);
      setSelectedBay(null);
      setDayOfWeek(null);
    } catch (error) {
      console.error('Error creating assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to create assignment',
        variant: 'destructive',
      });
    } finally {
      setAssignmentLoading(false);
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
            <Button variant="outline" className="w-full justify-between" onClick={handleNavigateToUsers}>
              <span>User Management</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between" onClick={handleNavigateToBays}>
              <span>Bay Management</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between" onClick={handleOpenAssignmentDialog}>
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
            <Button variant="outline" className="w-full justify-between" onClick={() => toast({ title: "Coming Soon", description: "Announcements feature is under development." })}>
              <span>Create Announcement</span>
              <MegaphoneIcon className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between" onClick={() => toast({ title: "Coming Soon", description: "Activity Logs feature is under development." })}>
              <span>View Activity Logs</span>
              <BookOpenText className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Assignment Dialog */}
      <Dialog open={openAssignmentDialog} onOpenChange={setOpenAssignmentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Permanent Assignment</DialogTitle>
            <DialogDescription>
              Assign a bay to a user for a specific day of the week.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="user">User</Label>
              <Select
                value={selectedUser || ""}
                onValueChange={setSelectedUser}
              >
                <SelectTrigger id="user">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bay">Bay</Label>
              <Select
                value={selectedBay || ""}
                onValueChange={setSelectedBay}
              >
                <SelectTrigger id="bay">
                  <SelectValue placeholder="Select a bay" />
                </SelectTrigger>
                <SelectContent>
                  {bays.map((bay) => (
                    <SelectItem key={bay.bay_id} value={bay.bay_id}>
                      Bay {bay.bay_number} - {bay.location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="day">Day of Week</Label>
              <Select
                value={dayOfWeek || ""}
                onValueChange={setDayOfWeek}
              >
                <SelectTrigger id="day">
                  <SelectValue placeholder="Select a day" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monday">Monday</SelectItem>
                  <SelectItem value="Tuesday">Tuesday</SelectItem>
                  <SelectItem value="Wednesday">Wednesday</SelectItem>
                  <SelectItem value="Thursday">Thursday</SelectItem>
                  <SelectItem value="Friday">Friday</SelectItem>
                  <SelectItem value="Saturday">Saturday</SelectItem>
                  <SelectItem value="Sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleCreateAssignment} disabled={assignmentLoading}>
              {assignmentLoading ? "Creating..." : "Create Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
