
import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useToast } from "@/components/ui/use-toast";
import { useSupabaseSubscription } from './useSupabaseSubscription';

export interface BayReservation {
  bay_id: string;
  bay_number: number;
  reservation_type: 'Permanent' | 'Daily';
  day_or_date: string;
  user_name: string;
  status: string;
  claim_id?: string;
  assignment_id?: string;
}

export const useBayAssignments = () => {
  const [reservations, setReservations] = useState<BayReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentDayOfWeek = format(new Date(), 'EEEE');
  const isMountedRef = useRef(true);
  
  const fetchAssignments = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      setLoading(true);
      
      // Fetch bays
      const { data: baysData, error: baysError } = await supabase
        .from('bays')
        .select('bay_id, bay_number')
        .order('bay_number');
        
      if (baysError) throw baysError;
      
      // Fetch ALL permanent assignments regardless of day of week
      const { data: permanentData, error: permanentError } = await supabase
        .from('permanent_assignments')
        .select(`
          assignment_id,
          bay_id,
          user_id,
          day_of_week,
          available_from,
          available_to
        `);
        
      if (permanentError) throw permanentError;
      
      // Fetch daily claims for today (both active and cancelled)
      const { data: dailyData, error: dailyError } = await supabase
        .from('daily_claims')
        .select(`
          claim_id,
          bay_id,
          user_id,
          claim_date,
          status
        `)
        .eq('claim_date', today);
        
      if (dailyError) throw dailyError;
      
      if (!isMountedRef.current) return;
      
      console.log('Fetched daily claims for table:', dailyData);
      console.log('Fetched permanent assignments for table:', permanentData);
      
      // Fetch user names
      const userIds = new Set<string>();
      permanentData.forEach(pa => userIds.add(pa.user_id));
      dailyData.forEach(dc => userIds.add(dc.user_id));
      
      let userNames: Record<string, string> = {};
      
      if (userIds.size > 0) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('user_id, name')
          .in('user_id', Array.from(userIds));
          
        if (userError) throw userError;
        
        userData.forEach(u => {
          userNames[u.user_id] = u.name;
        });
      }
      
      if (!isMountedRef.current) return;
      
      // Create map of daily claims by bay_id
      const dailyClaimsByBay = new Map<string, any[]>();
      dailyData.forEach(claim => {
        if (!dailyClaimsByBay.has(claim.bay_id)) {
          dailyClaimsByBay.set(claim.bay_id, []);
        }
        dailyClaimsByBay.get(claim.bay_id)?.push(claim);
      });
      
      // Combine all data
      const allReservations: BayReservation[] = [];
      
      // Add ALL permanent assignments regardless of day, to show the full schedule
      permanentData.forEach(pa => {
        const bayNumber = baysData.find(b => b.bay_id === pa.bay_id)?.bay_number;
        
        if (bayNumber) {
          // Check if this is for today's day of week
          const isForToday = pa.day_of_week === currentDayOfWeek || pa.day_of_week === 'All Days';
          
          // Check if temporarily available for today based on date range
          const isTemporarilyAvailable = 
            pa.available_from && pa.available_to && 
            today >= pa.available_from && today <= pa.available_to;
            
          // Check if there's a cancellation for today
          const dailyClaims = dailyClaimsByBay.get(pa.bay_id) || [];
          const cancelledForToday = isForToday && dailyClaims.some(
            claim => claim.user_id === pa.user_id && claim.status === 'Cancelled'
          );
          
          if (isForToday && isTemporarilyAvailable) {
            allReservations.push({
              bay_id: pa.bay_id,
              bay_number: bayNumber,
              reservation_type: 'Permanent',
              day_or_date: pa.day_of_week,
              user_name: userNames[pa.user_id] || 'Unknown',
              status: `Temporarily available (${pa.available_from} to ${pa.available_to})`,
              assignment_id: pa.assignment_id
            });
          } else if (isForToday && cancelledForToday) {
            allReservations.push({
              bay_id: pa.bay_id,
              bay_number: bayNumber,
              reservation_type: 'Permanent',
              day_or_date: pa.day_of_week,
              user_name: userNames[pa.user_id] || 'Unknown',
              status: 'Cancelled for today',
              assignment_id: pa.assignment_id
            });
          } else {
            // Show regular permanent assignment with appropriate status
            allReservations.push({
              bay_id: pa.bay_id,
              bay_number: bayNumber,
              reservation_type: 'Permanent',
              day_or_date: pa.day_of_week,
              user_name: userNames[pa.user_id] || 'Unknown',
              status: isForToday ? 'Active' : 'Scheduled',
              assignment_id: pa.assignment_id
            });
          }
        }
      });
      
      // Add daily claims
      dailyData.forEach(dc => {
        // Show all daily claims, both active and cancelled
        const bayNumber = baysData.find(b => b.bay_id === dc.bay_id)?.bay_number;
        
        if (bayNumber) {
          // For daily claims, we want to show both active and cancelled
          allReservations.push({
            bay_id: dc.bay_id,
            bay_number: bayNumber,
            reservation_type: 'Daily',
            day_or_date: dc.claim_date,
            user_name: userNames[dc.user_id] || 'Unknown',
            status: dc.status,
            claim_id: dc.claim_id
          });
        }
      });
      
      // Sort by bay number
      allReservations.sort((a, b) => a.bay_number - b.bay_number);
      
      if (isMountedRef.current) {
        setReservations(allReservations);
      }
    } catch (error) {
      console.error('Error fetching bay assignments:', error);
      if (isMountedRef.current) {
        toast({
          title: 'Error',
          description: 'Failed to load bay assignments',
          variant: 'destructive',
        });
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [today, currentDayOfWeek, toast]);
  
  // Use our custom hook for Supabase subscriptions
  useSupabaseSubscription(
    [
      { table: 'daily_claims' },
      { table: 'permanent_assignments' },
      { table: 'bays' }
    ],
    fetchAssignments
  );
  
  const handleRefresh = () => {
    if (isMountedRef.current) {
      setRefreshing(true);
      fetchAssignments();
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch
    fetchAssignments();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchAssignments]);

  return {
    reservations,
    loading,
    refreshing,
    handleRefresh
  };
};
