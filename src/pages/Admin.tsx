import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User, Bay, castToUser, castToBay } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserApproval from '@/components/UserApproval';
import { 
  ParkingSquare, 
  CalendarClock, 
  MegaphoneIcon,
  BookOpenText,
  ChevronRight,
  UserCheck
} from 'lucide-react';

const Admin = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
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
  const [pendingUsersCount, setPendingUsersCount] = useState(0);

  const fetchPendingUsersCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending');
      
      if (error) throw error;
      
      setPendingUsersCount(count || 0);
    } catch (error) {
      console.error('Error fetching pending users count:', error);
    }
  }, []);

  useEffect(() => {
    console.log("Current auth state:", { user, session, isAdmin: user?.role === 'Admin' });
    fetchPendingUsersCount();
    setLoading(false);
  }, [user, session, fetchPendingUsersCount]);

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
        .select('assignment_id, day_of_week')
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
      
      console.log("Existing assignments:", data);
    } catch (error) {
      console.error('Error fetching existing assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch existing assignments',
        variant: 'destructive',
      });
    }
  };

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
      
      if (removedDays.length > 0) {
        console.log('Starting deletion process for days:', removedDays);
        
        for (const day of removedDays) {
          console.log(`Attempting to delete assignment: user_id=${selectedUser}, bay_id=${selectedBay}, day_of_week=${day}`);
          
          const { data: assignmentToDelete, error: findError } = await supabase
            .from('permanent_assignments')
            .select('assignment_id')
            .eq('user_id', selectedUser)
            .eq('bay_id', selectedBay)
            .eq('day_of_week', day)
            .maybeSingle();
          
          if (findError) {
            console.error(`Error finding assignment to delete:`, findError);
            toast({
              title: 'Error',
              description: `Error finding assignment to delete: ${findError.message}`,
              variant: 'destructive',
            });
            continue;
          }
          
          if (!assignmentToDelete) {
            console.log(`No assignment found for day ${day}, skipping deletion.`);
            continue;
          }
          
          console.log(`Found assignment to delete:`, assignmentToDelete);
          
          const { error: deleteError, status, statusText } = await supabase
            .from('permanent_assignments')
            .delete()
            .eq('assignment_id', assignmentToDelete.assignment_id);
          
          if (deleteError) {
            console.error(`Failed to delete assignment for ${day}:`, deleteError);
            console.error(`Delete response status: ${status} ${statusText}`);
            toast({
              title: 'Error',
              description: `Failed to delete assignment for ${day}: ${deleteError.message}`,
              variant: 'destructive',
            });
          } else {
            console.log(`Successfully deleted assignment for ${day}, status: ${status}`);
            toast({
              title: 'Success',
              description: `Successfully removed assignment for ${day}`,
            });
          }
        }
        
        const { data: remainingAssignments, error: checkError } = await supabase
          .from('permanent_assignments')
          .select('*')
          .eq('user_id', selectedUser)
          .eq('bay_id', selectedBay);
        
        if (checkError) {
          console.error('Error checking remaining assignments:', checkError);
        } else {
          console.log('Remaining assignments after deletion:', remainingAssignments);
          
          const anyRemovedDaysStillPresent = remainingAssignments?.some(
            assignment => removedDays.includes(assignment.day_of_week)
          );
          
          if (anyRemovedDaysStillPresent) {
            console.warn('Some assignments were not deleted properly!');
            toast({
              title: 'Warning',
              description: 'Some assignments may not have been deleted properly. Please try again.',
              variant: 'destructive',
            });
          }
        }
      }
      
      const daysToAssign = Object.entries(selectedDays)
        .filter(([day, isSelected]) => isSelected && !existingAssignments.includes(day))
        .map(([day]) => day);
      
      if (daysToAssign.length > 0) {
        const assignmentsToCreate = daysToAssign.map(day => ({
          user_id: selectedUser,
          bay_id: selectedBay,
          day_of_week: day,
          created_by: user?.user_id
        }));
        
        const { error: insertError } = await supabase
          .from('permanent_assignments')
          .insert(assignmentsToCreate);
        
        if (insertError) {
          console.error('Error creating assignments:', insertError);
          throw insertError;
        }
      }
      
      await fetchExistingAssignments();
      
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
      
      <Tabs defaultValue={pendingUsersCount > 0 ? "approvals" : "management"}>
        <TabsList className="mb-4">
          <TabsTrigger value="management">Management</TabsTrigger>
          <TabsTrigger value="approvals" className="relative">
            User Approvals
            {pendingUsersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {pendingUsersCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="communications">Communications</TabsTrigger>
        </TabsList>

        <TabsContent value="management">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Management</CardTitle>
                <CardDescription>Manage bays and assignments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
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
          </div>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>User Approval Requests</CardTitle>
              <CardDescription>Manage new user signups that require approval</CardDescription>
            </CardHeader>
            <CardContent>
              <UserApproval onApprovalStatusChange={fetchPendingUsersCount} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communications">
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
        </TabsContent>
      </Tabs>
      
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
