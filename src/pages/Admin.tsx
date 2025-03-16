
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User, Bay, castToUser, castToBay } from '@/types';
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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  UserCog, 
  ParkingSquare, 
  CalendarClock, 
  MegaphoneIcon,
  BookOpenText,
  ChevronRight
} from 'lucide-react';

const Admin = () => {
  const { user, session } = useAuth();
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
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [selectedDays, setSelectedDays] = useState({
    Monday: false,
    Tuesday: false,
    Wednesday: false,
    Thursday: false,
    Friday: false,
    Saturday: false,
    Sunday: false
  });
  const [existingAssignments, setExistingAssignments] = useState<string[]>([]);
  const [removedDays, setRemovedDays] = useState<string[]>([]);

  useEffect(() => {
    fetchStats();
    console.log("Current auth state:", { user, session, isAdmin: user?.role === 'Admin' });
  }, [user, session]);

  useEffect(() => {
    if (selectedUser && selectedBay) {
      fetchExistingAssignments();
    } else {
      setSelectedDays({
        Monday: false,
        Tuesday: false,
        Wednesday: false,
        Thursday: false,
        Friday: false,
        Saturday: false,
        Sunday: false
      });
      setExistingAssignments([]);
      setRemovedDays([]);
    }
  }, [selectedUser, selectedBay]);

  const fetchExistingAssignments = async () => {
    if (!selectedUser || !selectedBay) return;
    
    try {
      const { data, error } = await supabase
        .from('permanent_assignments')
        .select('day_of_week')
        .eq('user_id', selectedUser)
        .eq('bay_id', selectedBay);
      
      if (error) throw error;
      
      const days = data.map(item => item.day_of_week);
      setExistingAssignments(days);
      
      const updatedSelectedDays = { ...selectedDays };
      Object.keys(updatedSelectedDays).forEach(day => {
        updatedSelectedDays[day as keyof typeof selectedDays] = days.includes(day);
      });
      
      setSelectedDays(updatedSelectedDays);
      setRemovedDays([]);
      
      console.log("Existing assignments:", days);
    } catch (error) {
      console.error('Error fetching existing assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch existing assignments',
        variant: 'destructive',
      });
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      
      const { count: userCount, error: userError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      if (userError) throw userError;
      
      const { count: bayCount, error: bayError } = await supabase
        .from('bays')
        .select('*', { count: 'exact', head: true });
      
      if (bayError) throw bayError;
      
      const { count: assignmentCount, error: assignmentError } = await supabase
        .from('permanent_assignments')
        .select('*', { count: 'exact', head: true });
      
      if (assignmentError) throw assignmentError;
      
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

  const handleNavigateToUsers = () => navigate('/users');
  const handleNavigateToBays = () => navigate('/bays');
  
  const handleDayChange = (day: keyof typeof selectedDays) => {
    setSelectedDays(prev => {
      const newSelectedDays = {
        ...prev,
        [day]: !prev[day]
      };
      
      if (existingAssignments.includes(day) && !newSelectedDays[day]) {
        setRemovedDays(prev => [...prev, day]);
      } 
      else if (existingAssignments.includes(day) && newSelectedDays[day]) {
        setRemovedDays(prev => prev.filter(d => d !== day));
      }
      
      return newSelectedDays;
    });
  };

  const areAnyDaysSelected = () => {
    return Object.values(selectedDays).some(selected => selected);
  };

  const hasChanges = () => {
    const daysToAssign = Object.entries(selectedDays)
      .filter(([day, isSelected]) => isSelected && !existingAssignments.includes(day))
      .map(([day]) => day);
    
    return daysToAssign.length > 0 || removedDays.length > 0;
  };
  
  const handleOpenAssignmentDialog = async () => {
    try {
      const [usersResponse, baysResponse] = await Promise.all([
        supabase.from('users').select('*').order('name'),
        supabase.from('bays').select('*').order('bay_number')
      ]);
      
      if (usersResponse.error) throw usersResponse.error;
      if (baysResponse.error) throw baysResponse.error;
      
      const typedUsers = (usersResponse.data || []).map(castToUser);
      const typedBays = (baysResponse.data || []).map(castToBay);
      
      setUsers(typedUsers);
      setBays(typedBays);
      setOpenAssignmentDialog(true);
      
      setSelectedUser(null);
      setSelectedBay(null);
      setSelectedDays({
        Monday: false,
        Tuesday: false,
        Wednesday: false,
        Thursday: false,
        Friday: false,
        Saturday: false,
        Sunday: false
      });
      setExistingAssignments([]);
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
    if (!selectedUser || !selectedBay) {
      toast({
        title: 'Validation Error',
        description: 'Please select a user and bay',
        variant: 'destructive',
      });
      return;
    }
    
    if (!hasChanges()) {
      toast({
        title: 'No Changes',
        description: 'No changes were made to the assignments',
      });
      return;
    }
    
    try {
      setAssignmentLoading(true);
      
      console.log("Current auth state before creating assignment:", { 
        user, 
        session, 
        hasSessionObject: !!session,
        accessToken: session?.access_token?.substring(0, 10) + '...',
        selectedDays,
        removedDays
      });
      
      if (!session) {
        console.error("No active session found");
        toast({
          title: 'Authentication Error',
          description: 'You must be logged in to create assignments. Please refresh the page and try again.',
          variant: 'destructive',
        });
        setAssignmentLoading(false);
        return;
      }
      
      if (!user || user.role !== 'Admin') {
        console.error("User is not an admin:", user?.role);
        toast({
          title: 'Permission Error',
          description: 'Only administrators can create assignments.',
          variant: 'destructive',
        });
        setAssignmentLoading(false);
        return;
      }
      
      const daysToAssign = Object.entries(selectedDays)
        .filter(([day, isSelected]) => isSelected && !existingAssignments.includes(day))
        .map(([day]) => day);
      
      console.log('Creating assignments for days:', daysToAssign);
      console.log('Removing assignments for days:', removedDays);
      
      const assignmentsToCreate = daysToAssign.map(day => ({
        user_id: selectedUser,
        bay_id: selectedBay,
        day_of_week: day,
        created_by: user?.user_id
      }));
      
      // FIX: Improved deletion logic with better logging
      if (removedDays.length > 0) {
        console.log('Attempting to delete assignments for days:', removedDays);
        
        for (const day of removedDays) {
          console.log(`Deleting assignment for day: ${day}, user: ${selectedUser}, bay: ${selectedBay}`);
          
          // First, retrieve the assignment to confirm it exists
          const { data: assignmentToDelete, error: findError } = await supabase
            .from('permanent_assignments')
            .select('*')
            .eq('user_id', selectedUser)
            .eq('bay_id', selectedBay)
            .eq('day_of_week', day);
            
          console.log(`Found assignments to delete:`, assignmentToDelete);
          
          if (findError) {
            console.error(`Error finding assignment for ${day}:`, findError);
            continue;
          }
          
          if (!assignmentToDelete || assignmentToDelete.length === 0) {
            console.warn(`No assignment found for ${day} to delete`);
            continue;
          }
          
          // Then perform the delete with explicit match on all three fields
          const { error: deleteError, count } = await supabase
            .from('permanent_assignments')
            .delete()
            .match({
              user_id: selectedUser,
              bay_id: selectedBay,
              day_of_week: day
            });
          
          console.log(`Delete operation result for ${day}:`, { error: deleteError, count });
          
          if (deleteError) {
            console.error(`Error removing assignment for ${day}:`, deleteError);
            throw deleteError;
          }
        }
        
        // Verify deletion worked by refetching assignments
        const { data: verifyData, error: verifyError } = await supabase
          .from('permanent_assignments')
          .select('day_of_week')
          .eq('user_id', selectedUser)
          .eq('bay_id', selectedBay);
          
        console.log('After deletion, remaining assignments:', verifyData?.map(item => item.day_of_week));
      }
      
      if (assignmentsToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from('permanent_assignments')
          .insert(assignmentsToCreate);
        
        if (insertError) {
          console.error('Error creating assignments:', insertError);
          throw insertError;
        }
      }
      
      // Refetch assignments to ensure UI is synced with database
      await fetchExistingAssignments();
      await fetchStats();
      
      toast({
        title: 'Success',
        description: `Updated permanent assignments successfully`,
      });
      
      setOpenAssignmentDialog(false);
      
      setSelectedUser(null);
      setSelectedBay(null);
      setSelectedDays({
        Monday: false,
        Tuesday: false,
        Wednesday: false,
        Thursday: false,
        Friday: false,
        Saturday: false,
        Sunday: false
      });
      setExistingAssignments([]);
      setRemovedDays([]);
    } catch (error: any) {
      console.error('Error managing assignments:', error);
      toast({
        title: 'Error',
        description: `Failed to update assignments: ${error.message || 'Unknown error'}`,
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
      
      <Dialog open={openAssignmentDialog} onOpenChange={setOpenAssignmentDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Permanent Assignments</DialogTitle>
            <DialogDescription>
              Assign a bay to a user for specific days of the week. Check or uncheck days to update assignments.
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
              <Label>Days of Week</Label>
              <div className="grid grid-cols-1 gap-2">
                {Object.keys(selectedDays).map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`day-${day}`} 
                      checked={selectedDays[day as keyof typeof selectedDays]} 
                      onCheckedChange={() => handleDayChange(day as keyof typeof selectedDays)}
                    />
                    <Label htmlFor={`day-${day}`} className="cursor-pointer">{day}</Label>
                    {existingAssignments.includes(day) && (
                      <span className="text-xs text-muted-foreground ml-2">(Already assigned)</span>
                    )}
                    {removedDays.includes(day) && (
                      <span className="text-xs text-destructive ml-2">(Will be removed)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleCreateAssignment} disabled={assignmentLoading || !selectedUser || !selectedBay || !hasChanges()}>
              {assignmentLoading ? "Updating..." : "Update Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
