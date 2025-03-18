import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bay, castToBay } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import BayCard from '@/components/BayCard';
import ReserveBayDialog from '@/components/ReserveBayDialog';
import MakeBayAvailableDialog from '@/components/MakeBayAvailableDialog';
import BayAssignmentsTable from '@/components/BayAssignmentsTable';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

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
  
  const isMountedRef = useRef(true);
  const channelsRef = useRef<any[]>([]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchBays();

    const setupRealtimeSubscriptions = () => {
      if (channelsRef.current.length > 0) {
        channelsRef.current.forEach(channel => {
          supabase.removeChannel(channel);
        });
        channelsRef.current = [];
      }
      
      const timestamp = Date.now();
      
      const dailyClaimsChannel = supabase
        .channel(`daily-claims-changes-${timestamp}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'daily_claims'
          },
          () => {
            console.log('Daily claims changed, refreshing bays...');
            if (isMountedRef.current) {
              fetchBays();
            }
          }
        )
        .subscribe();
      channelsRef.current.push(dailyClaimsChannel);

      const permanentAssignmentsChannel = supabase
        .channel(`permanent-assignments-changes-${timestamp}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'permanent_assignments'
          },
          () => {
            console.log('Permanent assignments changed, refreshing bays...');
            if (isMountedRef.current) {
              fetchBays();
            }
          }
        )
        .subscribe();
      channelsRef.current.push(permanentAssignmentsChannel);

      const baysChannel = supabase
        .channel(`bays-changes-${timestamp}`)
        .on(
          'postgres_changes',
          {
            event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'bays'
          },
          () => {
            console.log('Bays changed, refreshing bays...');
            if (isMountedRef.current) {
              fetchBays();
            }
          }
        )
        .subscribe();
      channelsRef.current.push(baysChannel);

      return channelsRef.current;
    };

    setupRealtimeSubscriptions();

    return () => {
      console.log('Cleaning up Bays component and all Supabase channels...');
      
      isMountedRef.current = false;
      
      channelsRef.current.forEach(channel => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };
  }, []);

  const fetchBays = async () => {
    if (!isMountedRef.current) return;
    
    try {
      setLoading(true);
      
      const { data: baysData, error: baysError } = await supabase
        .from('bays')
        .select('*')
        .order('bay_number');

      if (baysError) throw baysError;
      
      const { data: dailyClaimsData, error: claimsError } = await supabase
        .from('daily_claims')
        .select('bay_id, user_id, status')
        .eq('claim_date', today);
        
      if (claimsError) throw claimsError;
      
      const { data: permanentAssignmentsData, error: assignmentsError } = await supabase
        .from('permanent_assignments')
        .select('bay_id, user_id, day_of_week, available_from, available_to')
        .or(`day_of_week.eq.${currentDayOfWeek},day_of_week.eq.All Days`);
        
      if (assignmentsError) throw assignmentsError;
      
      console.log('Today:', today);
      console.log('Current day of week:', currentDayOfWeek);
      console.log('Daily claims:', dailyClaimsData);
      console.log('Permanent assignments:', permanentAssignmentsData);
      
      const activeDailyClaimsMap = new Map();
      const cancelledDailyClaimsMap = new Map();
      
      dailyClaimsData.forEach(claim => {
        if (claim.status === 'Active') {
          activeDailyClaimsMap.set(claim.bay_id, claim.user_id);
        } else if (claim.status === 'Cancelled') {
          if (!cancelledDailyClaimsMap.has(claim.bay_id)) {
            cancelledDailyClaimsMap.set(claim.bay_id, new Set());
          }
          cancelledDailyClaimsMap.get(claim.bay_id).add(claim.user_id);
        }
      });
      
      console.log('Cancelled Daily Claims Map:');
      cancelledDailyClaimsMap.forEach((userSet, bayId) => {
        console.log(`Bay ${bayId}:`, Array.from(userSet));
      });
      
      const permanentAssignmentsMap = new Map();
      const temporarilyAvailableBays = new Set();
      
      permanentAssignmentsData.forEach(assignment => {
        const isTemporarilyAvailable = 
          assignment.available_from && 
          assignment.available_to && 
          today >= assignment.available_from && 
          today <= assignment.available_to;
        
        if (isTemporarilyAvailable) {
          temporarilyAvailableBays.add(assignment.bay_id);
          console.log(`Bay ${assignment.bay_id} has temporary availability: ${assignment.available_from} to ${assignment.available_to}`);
        } else {
          permanentAssignmentsMap.set(assignment.bay_id, assignment.user_id);
        }
      });
      
      console.log('Permanent Assignments Map:');
      permanentAssignmentsMap.forEach((userId, bayId) => {
        console.log(`Bay ${bayId} assigned to: ${userId}`);
      });
      
      console.log('Temporarily available bays:', Array.from(temporarilyAvailableBays));
      
      const userIds = new Set<string>();
      dailyClaimsData.forEach(claim => userIds.add(claim.user_id));
      permanentAssignmentsData.forEach(assignment => userIds.add(assignment.user_id));
      
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
        
        if (isMountedRef.current) {
          setUserNames(namesMap);
        }
      }
      
      const updatedBays = baysData.map(bay => {
        const baseBay = castToBay(bay);
        
        if (baseBay.status === 'Maintenance') {
          return baseBay;
        }
        
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
        
        if (temporarilyAvailableBays.has(bay.bay_id)) {
          console.log(`Bay ${bay.bay_number} is temporarily available for today`);
          return {
            ...baseBay,
            status: 'Available' as Bay['status']
          };
        }
        
        if (permanentAssignmentsMap.has(bay.bay_id)) {
          const assignedToUserId = permanentAssignmentsMap.get(bay.bay_id);
          const assignedToUser = assignedToUserId === user?.user_id;
          
          const hasCancelledClaim = cancelledDailyClaimsMap.has(bay.bay_id) && 
                              cancelledDailyClaimsMap.get(bay.bay_id).has(assignedToUserId);
          
          console.log(`Bay ${bay.bay_number}: Permanent assignment to ${assignedToUserId}, cancelled: ${hasCancelledClaim}`);
          
          if (hasCancelledClaim) {
            console.log(`Bay ${bay.bay_number} has been cancelled by its permanent assignee - marking as AVAILABLE`);
            return {
              ...baseBay,
              status: 'Available' as Bay['status']
            };
          }
          
          return {
            ...baseBay,
            status: 'Reserved' as Bay['status'],
            reserved_by_you: assignedToUser,
            reserved_by: assignedToUserId,
            is_permanent: true
          };
        }
        
        return {
          ...baseBay,
          status: 'Available' as Bay['status']
        };
      });
      
      if (isMountedRef.current) {
        setBays(updatedBays as Bay[]);
      }
    } catch (error) {
      console.error('Error fetching bays:', error);
      if (isMountedRef.current) {
        toast({
          title: 'Error',
          description: 'Failed to load bays data',
          variant: 'destructive',
        });
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleBayClick = (bay: Bay) => {
    console.log('Bay clicked:', bay);
    setSelectedBay(bay);
    
    if (bay.reserved_by_you && bay.is_permanent) {
      setAvailabilityDialogOpen(true);
    } else {
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
