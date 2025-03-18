import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bay, castToBay } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import BayCard from '@/components/BayCard';
import ReserveBayDialog from '@/components/ReserveBayDialog';
import MakeBayAvailableDialog from '@/components/MakeBayAvailableDialog';
import BayAssignmentsTable from '@/components/BayAssignmentsTable';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

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
  const [reserveDialogOpen, setReserveDialogOpen] = useState(false);
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [userNames, setUserNames] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentDayOfWeek = format(new Date(), 'EEEE'); // Returns day name like "Monday"
  const isAdmin = user && user.role === 'Admin';

  useEffect(() => {
    fetchBays();

    // Setup subscription for real-time updates - fixed to avoid locking the UI
    const setupRealtimeSubscriptions = () => {
      const dailyClaimsChannel = supabase
        .channel('daily-claims-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'daily_claims'
          },
          () => {
            console.log('Daily claims changed, refreshing bays...');
            fetchBays();
          }
        )
        .subscribe();

      const permanentAssignmentsChannel = supabase
        .channel('permanent-assignments-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'permanent_assignments'
          },
          () => {
            console.log('Permanent assignments changed, refreshing bays...');
            fetchBays();
          }
        )
        .subscribe();

      const baysChannel = supabase
        .channel('bays-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'bays'
          },
          () => {
            console.log('Bays changed, refreshing bays...');
            fetchBays();
          }
        )
        .subscribe();

      return {
        dailyClaimsChannel,
        permanentAssignmentsChannel,
        baysChannel
      };
    };

    // Initialize channels
    const channels = setupRealtimeSubscriptions();

    // Cleanup subscriptions on component unmount
    return () => {
      console.log('Cleaning up Supabase channels...');
      if (channels.dailyClaimsChannel) supabase.removeChannel(channels.dailyClaimsChannel);
      if (channels.permanentAssignmentsChannel) supabase.removeChannel(channels.permanentAssignmentsChannel);
      if (channels.baysChannel) supabase.removeChannel(channels.baysChannel);
    };
  }, []);

  const fetchBays = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch all bays
      const { data: baysData, error: baysError } = await supabase
        .from('bays')
        .select('*')
        .order('bay_number');

      if (baysError) throw baysError;
      
      // 2. Get daily claims for today - include both active and cancelled claims
      const { data: dailyClaimsData, error: claimsError } = await supabase
        .from('daily_claims')
        .select('bay_id, user_id, status')
        .eq('claim_date', today);
        
      if (claimsError) throw claimsError;
      
      // 3. Get permanent assignments for today's day of week
      const { data: permanentAssignmentsData, error: assignmentsError } = await supabase
        .from('permanent_assignments')
        .select('bay_id, user_id, day_of_week, available_from, available_to')
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
      
      // Debug logging for cancelled claims
      console.log('Cancelled Daily Claims Map:');
      cancelledDailyClaimsMap.forEach((userSet, bayId) => {
        console.log(`Bay ${bayId}:`, Array.from(userSet));
      });
      
      // Map permanent assignments by bay_id, considering availability dates
      const permanentAssignmentsMap = new Map();
      const temporarilyAvailableBays = new Set();
      
      permanentAssignmentsData.forEach(assignment => {
        // Check if this assignment is temporarily available based on date range
        const isTemporarilyAvailable = 
          assignment.available_from && 
          assignment.available_to && 
          today >= assignment.available_from && 
          today <= assignment.available_to;
        
        if (isTemporarilyAvailable) {
          // Mark this bay as temporarily available
          temporarilyAvailableBays.add(assignment.bay_id);
          console.log(`Bay ${assignment.bay_id} has temporary availability: ${assignment.available_from} to ${assignment.available_to}`);
        } else {
          // Add to permanent assignments map
          permanentAssignmentsMap.set(assignment.bay_id, assignment.user_id);
        }
      });
      
      // Debug log permanent assignments
      console.log('Permanent Assignments Map:');
      permanentAssignmentsMap.forEach((userId, bayId) => {
        console.log(`Bay ${bayId} assigned to: ${userId}`);
      });
      
      console.log('Temporarily available bays:', Array.from(temporarilyAvailableBays));
      
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
            reserved_by: claimedByUserId,
            is_permanent: false
          };
        }
        
        // Check if bay is temporarily available (date range)
        if (temporarilyAvailableBays.has(bay.bay_id)) {
          console.log(`Bay ${bay.bay_number} is temporarily available for today`);
          return {
            ...baseBay,
            status: 'Available' as Bay['status']
          };
        }
        
        // Check if bay has a permanent assignment for today
        if (permanentAssignmentsMap.has(bay.bay_id)) {
          const assignedToUserId = permanentAssignmentsMap.get(bay.bay_id);
          const assignedToUser = assignedToUserId === user?.user_id;
          
          // Check if the permanent assignment has been cancelled for today by the assigned user
          const hasCancelledClaim = cancelledDailyClaimsMap.has(bay.bay_id) && 
                              cancelledDailyClaimsMap.get(bay.bay_id).has(assignedToUserId);
          
          console.log(`Bay ${bay.bay_number}: Permanent assignment to ${assignedToUserId}, cancelled: ${hasCancelledClaim}`);
          
          // If this specific user's permanent assignment is cancelled for today, mark bay as available
          if (hasCancelledClaim) {
            console.log(`Bay ${bay.bay_number} has been cancelled by its permanent assignee - marking as AVAILABLE`);
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
            reserved_by: assignedToUserId,
            is_permanent: true
          };
        }
        
        // Bay is available if it has no active claims or permanent assignments for today
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

  const handleBayClick = (bay: Bay) => {
    console.log('Bay clicked:', bay);
    setSelectedBay(bay);
    
    // If the bay is permanently assigned to the current user, open the make available dialog
    if (bay.reserved_by_you && bay.is_permanent) {
      setAvailabilityDialogOpen(true);
    } else {
      // Otherwise, open the reserve dialog (which includes revoke functionality for admins)
      setReserveDialogOpen(true);
    }
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
      </div>
      
      <Tabs defaultValue="all">
        <TabsList className="mb-6 w-full">
          <TabsTrigger value="all" className="flex-1">All Bays</TabsTrigger>
          <TabsTrigger value="available" className="flex-1">Available</TabsTrigger>
          <TabsTrigger value="reserved" className="flex-1">Reserved</TabsTrigger>
          <TabsTrigger value="assignments" className="flex-1">Assignments</TabsTrigger>
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
                    isAdmin={isAdmin}
                    isPermanent={bay.is_permanent}
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
        
        <TabsContent value="assignments">
          <BayAssignmentsTable />
        </TabsContent>
      </Tabs>

      <ReserveBayDialog 
        bay={selectedBay}
        open={reserveDialogOpen}
        onOpenChange={setReserveDialogOpen}
        onSuccess={fetchBays}
        isAdmin={isAdmin}
      />

      <MakeBayAvailableDialog 
        bay={selectedBay}
        open={availabilityDialogOpen}
        onOpenChange={setAvailabilityDialogOpen}
        onSuccess={fetchBays}
      />
    </div>
  );
};

export default Bays;
