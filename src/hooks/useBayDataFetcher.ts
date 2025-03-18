
import { useCallback } from 'react';
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
      console.log('Fetching bay data...');
      
      // Fetch bays data
      const { data: baysData, error: baysError } = await supabase
        .from('bays')
        .select('*')
        .order('bay_number');

      if (baysError) {
        console.error('Error fetching bays:', baysError);
        throw baysError;
      }
      
      // Validate bays data
      if (!baysData || !Array.isArray(baysData) || baysData.length === 0) {
        console.warn('No bays data returned or invalid format:', baysData);
        // Return empty arrays instead of throwing
        return { 
          baysData: [], 
          dailyClaimsData: [], 
          permanentAssignmentsData: [] 
        };
      }
      
      console.log('Successfully fetched bays data:', baysData.length);
      
      // Fetch daily claims for today
      const { data: dailyClaimsData, error: claimsError } = await supabase
        .from('daily_claims')
        .select('bay_id, user_id, status')
        .eq('claim_date', today);
        
      if (claimsError) {
        console.error('Error fetching daily claims:', claimsError);
        // Continue despite error, just use empty array
        return { 
          baysData: baysData || [], 
          dailyClaimsData: [], 
          permanentAssignmentsData: [] 
        };
      }
      
      // Query permanent assignments for today's day of week
      const { data: permanentAssignmentsData, error: assignmentsError } = await supabase
        .from('permanent_assignments')
        .select('bay_id, user_id, day_of_week, available_from, available_to')
        .or(`day_of_week.eq.${currentDayOfWeek},day_of_week.eq.All Days`);
        
      if (assignmentsError) {
        console.error('Error fetching permanent assignments:', assignmentsError);
        // Continue despite error, just use empty array
        return { 
          baysData: baysData || [], 
          dailyClaimsData: dailyClaimsData || [], 
          permanentAssignmentsData: [] 
        };
      }
      
      console.log('Today:', today);
      console.log('Current day of week:', currentDayOfWeek);
      console.log('Daily claims:', dailyClaimsData?.length || 0);
      console.log('Permanent assignments:', permanentAssignmentsData?.length || 0);
      console.log('All bays data:', baysData?.length || 0);
      
      // Extract all user IDs for fetching names
      const userIds = new Set<string>();
      if (dailyClaimsData && Array.isArray(dailyClaimsData)) {
        dailyClaimsData.forEach(claim => {
          if (claim && claim.user_id) userIds.add(claim.user_id);
        });
      }
      if (permanentAssignmentsData && Array.isArray(permanentAssignmentsData)) {
        permanentAssignmentsData.forEach(assignment => {
          if (assignment && assignment.user_id) userIds.add(assignment.user_id);
        });
      }
      
      // Fetch user names if there are any user IDs
      if (userIds.size > 0) {
        try {
          await fetchUserNames(userIds);
        } catch (error) {
          console.error('Error fetching user names:', error);
          // Continue anyway
        }
      }
      
      return { 
        baysData: baysData || [], 
        dailyClaimsData: dailyClaimsData || [], 
        permanentAssignmentsData: permanentAssignmentsData || []
      };
    } catch (error) {
      console.error('Error fetching bay data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load bays data',
        variant: 'destructive',
      });
      // Always return empty arrays on error
      return { 
        baysData: [], 
        dailyClaimsData: [], 
        permanentAssignmentsData: [] 
      };
    }
  }, [today, currentDayOfWeek, fetchUserNames, toast]);
  
  return {
    fetchBayData,
    userNames,
    today,
    currentDayOfWeek
  };
};
