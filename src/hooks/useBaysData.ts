
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bay, castToBay } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { useSupabaseSubscription } from '@/hooks/useSupabaseSubscription';
import { useAuth } from '@/contexts/AuthContext';

export function useBaysData() {
  const [bays, setBays] = useState<Bay[]>([]);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<{[key: string]: string}>({});
  const { toast } = useToast();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentDayOfWeek = format(new Date(), 'EEEE'); // Returns day name like "Monday"
  
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
      
      const { data: dailyClaimsData, error: claimsError } = await supabase
        .from('daily_claims')
        .select('bay_id, user_id, status')
        .eq('claim_date', today);
        
      if (claimsError) throw claimsError;
      
      if (!isMountedRef.current) return;
      
      // Query permanent assignments that are active for today
      // Include both current day of week and 'All Days'
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
      console.log('All bays data:', baysData);
      
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
      
      // Fixed: Properly check day of week match and temporary availability
      permanentAssignmentsData.forEach(assignment => {
        // Check if bay is temporarily made available by its permanent assignee
        const isTemporarilyAvailable = 
          assignment.available_from && 
          assignment.available_to && 
          today >= assignment.available_from && 
          today <= assignment.available_to;
        
        if (isTemporarilyAvailable) {
          temporarilyAvailableBays.set(assignment.bay_id, assignment.user_id);
          console.log(`Bay ${assignment.bay_id} has temporary availability: ${assignment.available_from} to ${assignment.available_to}`);
        } 
        // Only add to permanentAssignmentsMap if the day matches current day
        else if (assignment.day_of_week === currentDayOfWeek || assignment.day_of_week === 'All Days') {
          // If the bay isn't already marked as temporarily available, add it to permanent assignments
          if (!temporarilyAvailableBays.has(assignment.bay_id)) {
            permanentAssignmentsMap.set(assignment.bay_id, assignment.user_id);
            console.log(`Bay ${assignment.bay_id} permanently assigned to ${assignment.user_id} for ${assignment.day_of_week}`);
          }
        }
      });
      
      console.log('Permanent Assignments Map:');
      permanentAssignmentsMap.forEach((userId, bayId) => {
        console.log(`Bay ${bayId} assigned to: ${userId}`);
      });
      
      console.log('Temporarily available bays:', Array.from(temporarilyAvailableBays.entries()));
      
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
        const baseBay = castToBay(bay);
        
        if (baseBay.status === 'Maintenance') {
          return baseBay;
        }
        
        // Check active daily claims first (highest priority)
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
        
        // Check if temporarily available
        if (temporarilyAvailableBays.has(bay.bay_id)) {
          console.log(`Bay ${bay.bay_number} is temporarily available for today`);
          return {
            ...baseBay,
            status: 'Available' as Bay['status']
          };
        }
        
        // Check permanent assignments
        if (permanentAssignmentsMap.has(bay.bay_id)) {
          const assignedToUserId = permanentAssignmentsMap.get(bay.bay_id);
          const assignedToUser = assignedToUserId === user?.user_id;
          
          // Check if the permanent assignee has cancelled for today
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
        
        // If no claims or assignments, bay is available
        return {
          ...baseBay,
          status: 'Available' as Bay['status']
        };
      });
      
      if (isMountedRef.current) {
        // Log the final bay status for debugging
        updatedBays.forEach(bay => {
          console.log(`Final status - Bay ${bay.bay_number}: ${bay.status}${bay.reserved_by ? ' (Reserved by: ' + bay.reserved_by + ')' : ''}`);
        });
        
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

  return {
    bays,
    loading,
    userNames,
    fetchBays,
    isAdmin: user && user.role === 'Admin'
  };
}
