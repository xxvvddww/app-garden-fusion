import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { User, Bay, castToUser, castToBay, DailyClaim, PermanentAssignment, castToDailyClaim } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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
  UserCheck,
  X,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ClaimWithDetails extends DailyClaim {
  userName: string;
  bayNumber: number;
  bayLocation: string;
}

interface AssignmentWithDetails extends PermanentAssignment {
  userName: string;
  bayNumber: number;
  bayLocation: string;
}

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
  const [activeTab, setActiveTab] = useState(pendingUsersCount > 0 ? "approvals" : "management");
  const { toast } = useToast();

  useEffect(() => {
    setLoading(false);
    fetchPendingUsersCount();
  }, []);

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

  const fetchDailyClaims = async () => {
    try {
      setLoadingClaims(true);
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Get all active daily claims for today
      const { data: claimsData, error: claimsError } = await supabase
        .from('daily_claims')
        .select('*')
        .eq('claim_date', today)
        .eq('status', 'Active');
      
      if (claimsError) throw claimsError;
      
      if (!claimsData || claimsData.length === 0) {
        setDailyClaims([]);
        setLoadingClaims(false);
        return;
      }
      
      // Get user details and bay details for each claim
      const claimsWithDetails = await Promise.all(claimsData.map(async (claim) => {
        // Get user info
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('name')
          .eq('user_id', claim.user_id)
          .single();
        
        if (userError) console.error(`Error fetching user for claim ${claim.claim_id}:`, userError);
        
        // Get bay info
        const { data: bayData, error: bayError } = await supabase
          .from('bays')
          .select('bay_number, location')
          .eq('bay_id', claim.bay_id)
          .single();
        
        if (bayError) console.error(`Error fetching bay for claim ${claim.claim_id}:`, bayError);
        
        return {
          ...claim,
          userName: userData?.name || 'Unknown User',
          bayNumber: bayData?.bay_number || 0,
          bayLocation: bayData?.location || 'Unknown Location'
        } as ClaimWithDetails;
      }));
      
      setDailyClaims(claimsWithDetails);
    } catch (error) {
      console.error('Error fetching daily claims:', error);
      toast({
        title: 'Error',
        description: 'Failed to load current bay reservations',
        variant: 'destructive',
      });
    } finally {
      setLoadingClaims(false);
    }
  };

  const fetchPermanentAssignments = async () => {
    try {
      setLoadingAssignments(true);
      
      // Get all permanent assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('permanent_assignments')
        .select('*');
      
      if (assignmentsError) throw assignmentsError;
      
      if (!assignmentsData || assignmentsData.length === 0) {
        setPermanentAssignments([]);
        setLoadingAssignments(false);
        return;
      }
      
      // Get user details and bay details for each assignment
      const assignmentsWithDetails = await Promise.all(assignmentsData.map(async (assignment) => {
        // Get user info
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('name')
          .eq('user_id', assignment.user_id)
          .single();
        
        if (userError) console.error(`Error fetching user for assignment ${assignment.assignment_id}:`, userError);
        
        // Get bay info
        const { data: bayData, error: bayError } = await supabase
          .from('bays')
          .select('bay_number, location')
          .eq('bay_id', assignment.bay_id)
          .single();
        
        if (bayError) console.error(`Error fetching bay for assignment ${assignment.assignment_id}:`, bayError);
        
        return {
          ...assignment,
          userName: userData?.name || 'Unknown User',
          bayNumber: bayData?.bay_number || 0,
          bayLocation: bayData?.location || 'Unknown Location'
        } as AssignmentWithDetails;
      }));
      
      setPermanentAssignments(assignmentsWithDetails);
    } catch (error) {
      console.error('Error fetching permanent assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load permanent bay assignments',
        variant: 'destructive',
      });
    } finally {
      setLoadingAssignments(false);
    }
  };

  const handleRevokeDailyClaim = async (claimId: string) => {
    try {
      setRevokingClaimId(claimId);
      
      console.log(`Revoking daily claim ${claimId}`);
      
      const { error } = await supabase
        .from('daily_claims')
        .update({ status: 'Cancelled' })
        .eq('claim_id', claimId);
      
      if (error) throw error;
      
      toast({
        title: 'Bay Revoked',
        description: 'The bay reservation has been successfully revoked',
      });
      
      // Refresh the list after successful revocation
      fetchDailyClaims();
    } catch (error) {
      console.error('Error revoking daily claim:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke the bay reservation',
        variant: 'destructive',
      });
    } finally {
      setRevokingClaimId(null);
    }
  };

  const handleRevokePermanentAssignment = async (assignmentId: string) => {
    try {
      setRevokingAssignmentId(assignmentId);
      
      console.log(`Revoking permanent assignment ${assignmentId}`);
      
      const { error } = await supabase
        .from('permanent_assignments')
        .delete()
        .eq('assignment_id', assignmentId);
      
      if (error) throw error;
      
      toast({
        title: 'Assignment Removed',
        description: 'The permanent bay assignment has been successfully removed',
      });
      
      // Refresh the list after successful revocation
      fetchPermanentAssignments();
    } catch (error) {
      console.error('Error revoking permanent assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove the permanent bay assignment',
        variant: 'destructive',
      });
    } finally {
      setRevokingAssignmentId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="management">Management</TabsTrigger>
          <TabsTrigger value="bayRevocation">Bay Revocation</TabsTrigger>
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

        <TabsContent value="bayRevocation">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Current Bay Reservations</CardTitle>
              <CardDescription>View and revoke today's bay reservations</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingClaims ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : dailyClaims.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No active bay reservations for today</p>
              ) : (
                <Table>
                  <TableCaption>Active bay reservations for today</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bay</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Reserved By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyClaims.map((claim) => (
                      <TableRow key={claim.claim_id}>
                        <TableCell>Bay {claim.bayNumber}</TableCell>
                        <TableCell>{claim.bayLocation}</TableCell>
                        <TableCell>{claim.userName}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                disabled={revokingClaimId === claim.claim_id}
                              >
                                {revokingClaimId === claim.claim_id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Revoking...
                                  </>
                                ) : (
                                  <>
                                    <X className="mr-2 h-4 w-4" />
                                    Revoke
                                  </>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke Bay Reservation</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to revoke the reservation for Bay {claim.bayNumber} from {claim.userName}?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleRevokeDailyClaim(claim.claim_id)}
                                >
                                  Yes, Revoke Bay
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Permanent Bay Assignments</CardTitle>
              <CardDescription>View and remove permanent bay assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAssignments ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : permanentAssignments.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No permanent bay assignments</p>
              ) : (
                <Table>
                  <TableCaption>Current permanent bay assignments</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bay</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permanentAssignments.map((assignment) => (
                      <TableRow key={assignment.assignment_id}>
                        <TableCell>Bay {assignment.bayNumber}</TableCell>
                        <TableCell>{assignment.bayLocation}</TableCell>
                        <TableCell>{assignment.userName}</TableCell>
                        <TableCell>{assignment.day_of_week}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                disabled={revokingAssignmentId === assignment.assignment_id}
                              >
                                {revokingAssignmentId === assignment.assignment_id ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Removing...
                                  </>
                                ) : (
                                  <>
                                    <X className="mr-2 h-4 w-4" />
                                    Remove
                                  </>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Permanent Assignment</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove the permanent assignment of Bay {assignment.bayNumber} 
                                  from {assignment.userName} for {assignment.day_of_week}?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleRevokePermanentAssignment(assignment.assignment_id)}
                                >
                                  Yes, Remove Assignment
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button 
                variant="outline" 
                onClick={fetchPermanentAssignments}
                disabled={loadingAssignments}
              >
                {loadingAssignments ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  'Refresh Assignments'
                )}
              </Button>
            </CardFooter>
          </Card>
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
