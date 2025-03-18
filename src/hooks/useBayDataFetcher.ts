
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useUserNames } from './useUserNames';

/**
 * Hook to fetch all the data needed for bay status calculations
 */
export const useBayDataFetcher = () => {
  const { toast } = useToast();
  const { userNames, fetchUserNames } = useUserNames();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentDayOfWeek = format(new Date(), 'EEEE'); // Returns day name like "Monday"
  
  const fetchBayData = useCallback(async () => {
    try {
      // Fetch bays data
      const { data: baysData, error: baysError } = await supabase
        .from('bays')
        .select('*')
        .order('bay_number');

      if (baysError) throw baysError;
      
      // Fetch daily claims for today
      const { data: dailyClaimsData, error: claimsError } = await supabase
        .from('daily_claims')
        .select('bay_id, user_id, status')
        .eq('claim_date', today);
        
      if (claimsError) throw claimsError;
      
      // Query permanent assignments for today's day of week
      const { data: permanentAssignmentsData, error: assignmentsError } = await supabase
        .from('permanent_assignments')
        .select('bay_id, user_id, day_of_week, available_from, available_to')
        .or(`day_of_week.eq.${currentDayOfWeek},day_of_week.eq.All Days`);
        
      if (assignmentsError) throw assignmentsError;
      
      console.log('Today:', today);
      console.log('Current day of week:', currentDayOfWeek);
      console.log('Daily claims:', dailyClaimsData);
      console.log('Permanent assignments:', permanentAssignmentsData);
      console.log('All bays data:', baysData);
      
      // Extract all user IDs for fetching names
      const userIds = new Set<string>();
      dailyClaimsData.forEach(claim => userIds.add(claim.user_id));
      permanentAssignmentsData.forEach(assignment => userIds.add(assignment.user_id));
      
      // Fetch user names if there are any user IDs
      if (userIds.size > 0) {
        await fetchUserNames(userIds);
      }
      
      return { baysData, dailyClaimsData, permanentAssignmentsData };
    } catch (error) {
      console.error('Error fetching bay data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load bays data',
        variant: 'destructive',
      });
      throw error;
    }
  }, [today, currentDayOfWeek, fetchUserNames, toast]);
  
  return {
    fetchBayData,
    userNames,
    today,
    currentDayOfWeek
  };
};
