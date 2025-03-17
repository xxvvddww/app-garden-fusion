import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bay, castToBay } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import BayCard from '@/components/BayCard';
import ReserveBayDialog from '@/components/ReserveBayDialog';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { 
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, X } from 'lucide-react';

interface ClaimWithDetails {
  claim_id: string;
  bay_id: string;
  user_id: string;
  userName: string;
  bayNumber: number;
  bayLocation: string;
  status: string;
}

interface AssignmentWithDetails {
  assignment_id: string;
  bay_id: string;
  user_id: string;
  userName: string;
  bayNumber: number;
  bayLocation: string;
  day_of_week: string;
}

const Bays = () => {
  const [bays, setBays] = useState<Bay[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [userNames, setUserNames] = useState<{[key: string]: string}>({});
  const [dailyClaims, setDailyClaims] = useState<ClaimWithDetails[]>([]);
  const [permanentAssignments, setPermanentAssignments] = useState<AssignmentWithDetails[]>([]);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [revokingClaimId, setRevokingClaimId] = useState<string | null>(null);
  const [revokingAssignmentId, setRevokingAssignmentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'management'>('grid');
  const { toast } = useToast();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentDayOfWeek = format(new Date(), 'EEEE'); // Returns day name like "Monday"
  const isAdmin = user && user.role === 'Admin';

  useEffect(() => {
    fetchBays();
    if (isAdmin && viewMode === 'management') {
      fetchDailyClaims();
      fetchPermanentAssignments();
    }
  }, [viewMode, isAdmin]);

  const fetchBays = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch all bays
      const { data: baysData, error: baysError } = await supabase
        .from('bays')
        .select('*')
        .order('bay_number');

      if (baysError) throw baysError;
      
      // 2. Get daily claims for today
      const { data: dailyClaimsData, error: claimsError } = await supabase
        .from('daily_claims')
        .select('bay_id, user_id, status')
        .eq('claim_date', today);
        
      if (claimsError) throw claimsError;
      
      // 3. Get permanent assignments for today's day of week
      const { data: permanentAssignmentsData, error: assignmentsError } = await supabase
        .from('permanent_assignments')
        .select('bay_id, user_id, day_of_week')
        .or(`day_of_week.eq.${currentDayOfWeek},day_of_week.eq.All Days`);
        
      if (assignmentsError) throw assignmentsError;
      
      console.log('Today:', today);
      console.log('Current day of week:', currentDayOfWeek);
      console.log('Daily claims:', dailyClaimsData);
      console.log('Permanent assignments:', permanentAssignmentsData);
      
      // Create maps for quick lookups
      // For daily claims, we need to consider both active and cancelled claims
      const activeDailyClaimsMap = new Map();
      const cancelledDailyClaimsMap = new Map();
      
      dailyClaimsData.forEach(claim => {
        if (claim.status === 'Active') {
          activeDailyClaimsMap.set(claim.bay_id, claim.user_id);
        } else if (claim.status === 'Cancelled') {
          // Keep track of which bays have been cancelled by which user
          if (!cancelledDailyClaimsMap.has(claim.bay_id)) {
            cancelledDailyClaimsMap.set(claim.bay_id, new Set());
          }
          cancelledDailyClaimsMap.get(claim.bay_id).add(claim.user_id);
        }
      });
      
      const permanentAssignmentsMap = new Map();
      permanentAssignmentsData.forEach(assignment => {
        permanentAssignmentsMap.set(assignment.bay_id, assignment.user_id);
      });
      
      // Collect all user IDs to fetch their names
      const userIds = new Set<string>();
      dailyClaimsData.forEach(claim => userIds.add(claim.user_id));
      permanentAssignmentsData.forEach(assignment => userIds.add(assignment.user_id));
      
      // Fetch user names if there are any reservations
      if (userIds.size > 0) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('user_id, name')
          .in('user_id', Array.from(userIds));
          
        if (userError) throw userError;
        
        const namesMap: {[key: string]: string} = {};
        userData.forEach(u => {
          namesMap[u.user_id] = u.name;
        });
        
        setUserNames(namesMap);
      }
      
      // Update bay status based on assignments and claims
      const updatedBays = baysData.map(bay => {
        const baseBay = castToBay(bay);
        
        // Check if bay is under maintenance - keep that status
        if (baseBay.status === 'Maintenance') {
          return baseBay;
        }
        
        // Check if bay is claimed for today (active claim takes precedence)
        if (activeDailyClaimsMap.has(bay.bay_id)) {
          const claimedByUserId = activeDailyClaimsMap.get(bay.bay_id);
          const claimedByUser = claimedByUserId === user?.user_id;
          return {
            ...baseBay,
            status: 'Reserved' as Bay['status'],
            reserved_by_you: claimedByUser,
            reserved_by: claimedByUserId
          };
        }
        
        // Check if bay is permanently assigned for today and hasn't been cancelled by user
        if (permanentAssignmentsMap.has(bay.bay_id)) {
          const assignedToUserId = permanentAssignmentsMap.get(bay.bay_id);
          const assignedToUser = assignedToUserId === user?.user_id;
          
          // Check if the user has cancelled their permanent assignment for today
          const hasCancelled = cancelledDailyClaimsMap.has(bay.bay_id) && 
                              cancelledDailyClaimsMap.get(bay.bay_id).has(assignedToUserId);
          
          // If user has cancelled their permanent assignment, bay is available
          if (hasCancelled && assignedToUser) {
            return {
              ...baseBay,
              status: 'Available' as Bay['status']
            };
          }
          
          // Otherwise, bay is still reserved
          return {
            ...baseBay,
            status: 'Reserved' as Bay['status'],
            reserved_by_you: assignedToUser,
            reserved_by: assignedToUserId
          };
        }
        
        // Bay is available
        return {
          ...baseBay,
          status: 'Available' as Bay['status']
        };
      });
      
      setBays(updatedBays as Bay[]);
    } catch (error) {
      console.error('Error fetching bays:', error);
      toast({
        title: 'Error',
        description: 'Failed to load bays data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyClaims = async () => {
    if (!isAdmin) return;
    
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
    if (!isAdmin) return;
    
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
      fetchBays();
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
      fetchBays();
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

  const handleBayClick = (bay: Bay) => {
    setSelectedBay(bay);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="h-[120px] w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Parking Bays</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'outline'} 
              onClick={() => setViewMode('grid')}
            >
              Bay Grid
            </Button>
            <Button 
              variant={viewMode === 'management' ? 'default' : 'outline'} 
              onClick={() => setViewMode('management')}
            >
              Bay Management
            </Button>
          </div>
        )}
      </div>
      
      {viewMode === 'grid' ? (
        <Tabs defaultValue="all">
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="all" className="flex-1">All Bays</TabsTrigger>
            <TabsTrigger value="available" className="flex-1">Available</TabsTrigger>
            <TabsTrigger value="reserved" className="flex-1">Reserved</TabsTrigger>
          </TabsList>
          
          {['all', 'available', 'reserved'].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {bays
                  .filter(bay => 
                    tab === 'all' || 
                    (tab === 'available' && bay.status === 'Available') ||
                    (tab === 'reserved' && bay.status === 'Reserved')
                  )
                  .map(bay => (
                    <BayCard 
                      key={bay.bay_id} 
                      bay={bay} 
                      onClick={handleBayClick}
                      reservedByName={bay.reserved_by ? userNames[bay.reserved_by] : undefined}
                    />
                  ))
                }
                
                {bays.filter(bay => 
                  tab === 'all' || 
                  (tab === 'available' && bay.status === 'Available') ||
                  (tab === 'reserved' && bay.status === 'Reserved')
                ).length === 0 && (
                  <div className="col-span-full">
                    <Card className="bg-[#0F1624] border-[#1E2A45] text-white">
                      <CardContent className="p-4">
                        <p className="text-center text-gray-400 py-4">
                          No {tab === 'all' ? 'bays' : `${tab} bays`} found
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Current Bay Reservations</CardTitle>
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
              <div className="mt-4 flex justify-center">
                <Button 
                  variant="outline" 
                  onClick={fetchDailyClaims}
                  disabled={loadingClaims}
                >
                  {loadingClaims ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    'Refresh Reservations'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Permanent Bay Assignments</CardTitle>
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
              <div className="mt-4 flex justify-center">
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
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ReserveBayDialog 
        bay={selectedBay}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchBays}
      />
    </div>
  );
};

export default Bays;
