import { useState, useEffect, useRef, useCallback } from 'react';
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
import { useSupabaseSubscription } from '@/hooks/useSupabaseSubscription';

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
  const timeoutRef = useRef<number | null>(null);

  const fetchBays = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      setLoading(true);
      
      const { data: baysData, error: baysError } = await supabase
        .from('bays')
        .select('*')
        .order('bay_number');

      if (baysError) throw baysError;
      
      console.log("Fetched bays data:", baysData);
      
      // Identify Bay 1 and Bay 2 for detailed logging
      const bay1 = baysData.find(bay => bay.bay_number === 1);
      const bay2 = baysData.find(bay => bay.bay_number === 2);
      console.log("Bay 1 raw data:", bay1);
      console.log("Bay 2 raw data:", bay2);
      
      // Important: Bay 1 database status
      if (bay1) {
        console.log("BAY 1 DATABASE STATUS:", bay1.status);
      }
      
      const { data: dailyClaimsData, error: claimsError } = await supabase
        .from('daily_claims')
        .select('bay_id, user_id, status')
        .eq('claim_date', today);
        
      if (claimsError) throw claimsError;
      
      if (!isMountedRef.current) return;
      
      const { data: permanentAssignmentsData, error: assignmentsError } = await supabase
        .from('permanent_assignments')
        .select('bay_id, user_id, day_of_week, available_from, available_to')
        .or(`day_of_week.eq.${currentDayOfWeek},day_of_week.eq.All Days`);
        
      if (assignmentsError) throw assignmentsError;
      
      if (!isMountedRef.current) return;
      
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
      const temporarilyAvailableBays = new Map();
      
      permanentAssignmentsData.forEach(assignment => {
        if (bay1 && assignment.bay_id === bay1.bay_id) {
          console.log(`BAY 1 ASSIGNMENT DETAILS:`, {
            available_from: assignment.available_from,
            available_from_type: typeof assignment.available_from,
            available_from_is_null: assignment.available_from === null,
            available_to: assignment.available_to,
            available_to_type: typeof assignment.available_to,
            available_to_is_null: assignment.available_to === null,
            day_of_week: assignment.day_of_week,
            user_id: assignment.user_id
          });
        }
        
        if (bay2 && assignment.bay_id === bay2.bay_id) {
          console.log(`BAY 2 ASSIGNMENT DETAILS:`, {
            available_from: assignment.available_from,
            available_from_type: typeof assignment.available_from,
            available_from_is_null: assignment.available_from === null,
            available_to: assignment.available_to,
            available_to_type: typeof assignment.available_to,
            available_to_is_null: assignment.available_to === null,
            day_of_week: assignment.day_of_week,
            user_id: assignment.user_id
          });
        }
        
        const isTemporarilyAvailable = 
          assignment.available_from !== null && 
          assignment.available_to !== null && 
          today >= assignment.available_from && 
          today <= assignment.available_to;
        
        if (isTemporarilyAvailable) {
          temporarilyAvailableBays.set(assignment.bay_id, assignment.user_id);
          console.log(`Bay ${assignment.bay_id} has temporary availability: ${assignment.available_from} to ${assignment.available_to}`);
        } else if (assignment.available_from === null && assignment.available_to === null) {
          permanentAssignmentsMap.set(assignment.bay_id, assignment.user_id);
          console.log(`Bay ${assignment.bay_id} has permanent assignment to user ${assignment.user_id}`);
        } else {
          console.log(`Bay ${assignment.bay_id} has neither temporary nor permanent status:`, {
            available_from: assignment.available_from || 'NULL',
            available_to: assignment.available_to || 'NULL',
            today: today
          });
        }
      });
      
      console.log('Permanent Assignments Map:');
      permanentAssignmentsMap.forEach((userId, bayId) => {
        console.log(`Bay ${bayId} assigned to: ${userId}`);
      });
      
      console.log('Temporarily available bays:');
      temporarilyAvailableBays.forEach((userId, bayId) => {
        console.log(`Bay ${bayId} temporarily available from user: ${userId}`);
      });
      
      if (bay1) {
        console.log(`Bay 1 (id: ${bay1.bay_id}) assignment status:`, {
          inPermanentAssignmentsMap: permanentAssignmentsMap.has(bay1.bay_id),
          inTemporarilyAvailableBaysMap: temporarilyAvailableBays.has(bay1.bay_id),
          inActiveDailyClaimsMap: activeDailyClaimsMap.has(bay1.bay_id),
          isCancelledByPermanentAssignee: 
            permanentAssignmentsMap.has(bay1.bay_id) && 
            cancelledDailyClaimsMap.has(bay1.bay_id) &&
            cancelledDailyClaimsMap.get(bay1.bay_id).has(permanentAssignmentsMap.get(bay1.bay_id))
        });
      }
      
      if (bay2) {
        console.log(`Bay 2 (id: ${bay2.bay_id}) assignment status:`, {
          inPermanentAssignmentsMap: permanentAssignmentsMap.has(bay2.bay_id),
          inTemporarilyAvailableBaysMap: temporarilyAvailableBays.has(bay2.bay_id),
          inActiveDailyClaimsMap: activeDailyClaimsMap.has(bay2.bay_id)
        });
      }
      
      if (!isMountedRef.current) return;
      
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
      
      if (!isMountedRef.current) return;
      
      const updatedBays = baysData.map(bay => {
        // Start with the bay's database status
        const baseBay = castToBay(bay);
        
        const isBay1 = bay.bay_number === 1;
        const isBay2 = bay.bay_number === 2;
        
        if (isBay1) {
          console.log("Processing Bay 1 status determination...");
          console.log("Bay 1 database status:", bay.status);
        }
        
        if (isBay2) {
          console.log("Processing Bay 2 status determination...");
          console.log("Bay 2 database status:", bay.status);
        }
        
        // Set additional properties regardless of status to show correct UI elements
        let additionalProps = {};
        
        // For maintenance bays, just keep the db status
        if (baseBay.status === 'Maintenance') {
          if (isBay1) console.log("Bay 1 is in Maintenance status, keeping it that way");
          if (isBay2) console.log("Bay 2 is in Maintenance status, keeping it that way");
          return baseBay;
        }
        
        // For permanent assignments, set the reserved_by_you and is_permanent flags
        if (permanentAssignmentsMap.has(bay.bay_id)) {
          const assignedToUserId = permanentAssignmentsMap.get(bay.bay_id);
          const assignedToUser = assignedToUserId === user?.user_id;
          
          additionalProps = {
            ...additionalProps,
            reserved_by: assignedToUserId,
            reserved_by_you: assignedToUser,
            is_permanent: true
          };
          
          if (isBay1) console.log("Bay 1 has permanent assignment properties set");
          if (isBay2) console.log("Bay 2 has permanent assignment properties set");
        }
        
        // For daily claims, override the reserved_by property
        if (activeDailyClaimsMap.has(bay.bay_id)) {
          const claimedByUserId = activeDailyClaimsMap.get(bay.bay_id);
          const claimedByUser = claimedByUserId === user?.user_id;
          
          additionalProps = {
            ...additionalProps,
            reserved_by: claimedByUserId,
            reserved_by_you: claimedByUser,
            is_permanent: false
          };
          
          if (isBay1) console.log("Bay 1 has active daily claim properties set");
          if (isBay2) console.log("Bay 2 has active daily claim properties set");
        }
        
        // IMPORTANT: Use the database status directly without overriding it
        if (isBay1) console.log(`FINAL BAY 1 STATUS: ${baseBay.status} (using database value)`);
        if (isBay2) console.log(`FINAL BAY 2 STATUS: ${baseBay.status} (using database value)`);
        
        return {
          ...baseBay,
          ...additionalProps
        };
      });
      
      if (isMountedRef.current) {
        const finalBay1 = updatedBays.find(bay => bay.bay_number === 1);
        const finalBay2 = updatedBays.find(bay => bay.bay_number === 2);
        
        if (finalBay1) {
          console.log("FINAL BAY 1 STATUS:", finalBay1.status);
          console.log("FINAL BAY 1 PROPS:", {
            reserved_by: finalBay1.reserved_by,
            reserved_by_you: finalBay1.reserved_by_you,
            is_permanent: finalBay1.is_permanent
          });
        }
        
        if (finalBay2) {
          console.log("FINAL BAY 2 STATUS:", finalBay2.status);
          console.log("FINAL BAY 2 PROPS:", {
            reserved_by: finalBay2.reserved_by,
            reserved_by_you: finalBay2.reserved_by_you,
            is_permanent: finalBay2.is_permanent
          });
        }
        
        setBays(updatedBays as Bay[]);
        
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = window.setTimeout(() => {
          if (isMountedRef.current) {
            setLoading(false);
          }
        }, 300);
      }
    } catch (error) {
      console.error('Error fetching bays:', error);
      if (isMountedRef.current) {
        toast({
          title: 'Error',
          description: 'Failed to load bays data',
          variant: 'destructive',
        });
        setLoading(false);
      }
    }
  }, [today, currentDayOfWeek, user, toast]);
  
  useSupabaseSubscription(
    [
      { table: 'daily_claims' },
      { table: 'permanent_assignments' },
      { table: 'bays' }
    ],
    fetchBays
  );

  useEffect(() => {
    isMountedRef.current = true;
    
    fetchBays();
    
    return () => {
      console.log('Cleaning up Bays component');
      isMountedRef.current = false;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [fetchBays]);

  const handleBayClick = (bay: Bay) => {
    if (!isMountedRef.current) return;
    
    console.log('Bay clicked:', bay);
    setSelectedBay(bay);
    
    if (bay.reserved_by_you && bay.is_permanent) {
      setAvailabilityDialogOpen(true);
    } else {
      setReserveDialogOpen(true);
    }
  };

  const handleDialogClose = () => {
    setSelectedBay(null);
    setReserveDialogOpen(false);
    setAvailabilityDialogOpen(false);
  };

  const handleReservationSuccess = () => {
    setSelectedBay(null);
    setReserveDialogOpen(false);
    setAvailabilityDialogOpen(false);
    fetchBays();
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
        onOpenChange={(open) => {
          setReserveDialogOpen(open);
          if (!open) {
            setTimeout(() => {
              setSelectedBay(null);
            }, 100);
          }
        }}
        onSuccess={handleReservationSuccess}
        isAdmin={isAdmin}
      />

      <MakeBayAvailableDialog 
        bay={selectedBay}
        open={availabilityDialogOpen}
        onOpenChange={(open) => {
          setAvailabilityDialogOpen(open);
          if (!open) {
            setTimeout(() => {
              setSelectedBay(null);
            }, 100);
          }
        }}
        onSuccess={handleReservationSuccess}
      />
    </div>
  );
};

export default Bays;

