
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { BayReservation } from '@/hooks/useBayAssignments';
import { useUserNames } from './useUserNames';
import { processBayAssignments, extractUserIds } from '@/utils/bayAssignmentUtils';

/**
 * Hook to fetch bay assignment data
 */
export const useBayAssignmentsData = () => {
  const [reservations, setReservations] = useState<BayReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { userNames, fetchUserNames } = useUserNames();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentDayOfWeek = format(new Date(), 'EEEE');
  
  const fetchAssignments = useCallback(async () => {
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
      
      console.log('Fetched daily claims for table:', dailyData);
      console.log('Fetched permanent assignments for table:', permanentData);
      console.log('Current day of week for table:', currentDayOfWeek);
      
      // Fetch user names
      const userIds = extractUserIds(permanentData, dailyData);
      const userNamesMap = await fetchUserNames(userIds);
      
      // Process assignments into reservations
      const allReservations = processBayAssignments(
        baysData, 
        permanentData, 
        dailyData, 
        userNamesMap, 
        currentDayOfWeek, 
        today
      );
      
      setReservations(allReservations);
    } catch (error) {
      console.error('Error fetching bay assignments:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [today, currentDayOfWeek, fetchUserNames]);
  
  return {
    reservations,
    loading,
    refreshing,
    setRefreshing,
    fetchAssignments
  };
};
