
import { useState, useEffect, useRef, useCallback } from 'react';
import { Bay } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { useSupabaseSubscription } from '@/hooks/useSupabaseSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { useBayDataFetcher } from './useBayDataFetcher';
import { processBayData, logBayStatus } from '@/utils/bayDataUtils';

export function useBaysData() {
  const [bays, setBays] = useState<Bay[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<number | null>(null);
  
  const { 
    fetchBayData, 
    userNames, 
    today, 
    currentDayOfWeek 
  } = useBayDataFetcher();

  const fetchBays = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      console.log('Starting fetchBays...');
      setLoading(true);
      
      // Fetch all required data from Supabase
      const result = await fetchBayData();
      
      if (!isMountedRef.current) return;
      
      // Guard against missing result
      if (!result) {
        console.error('No data returned from fetchBayData');
        setBays([]);
        setLoading(false);
        return;
      }
      
      const { baysData, dailyClaimsData, permanentAssignmentsData } = result;
      
      // Log data fetched
      console.log('Data fetched:', {
        baysDataLength: baysData?.length || 0,
        dailyClaimsDataLength: dailyClaimsData?.length || 0,
        permanentAssignmentsDataLength: permanentAssignmentsData?.length || 0
      });
      
      // Process the bay data only if we have valid bays data
      if (baysData && Array.isArray(baysData) && baysData.length > 0) {
        const updatedBays = processBayData(
          baysData,
          dailyClaimsData || [], 
          permanentAssignmentsData || [],
          userNames,
          user?.user_id,
          today,
          currentDayOfWeek
        );
        
        if (isMountedRef.current) {
          console.log('Processed bays:', updatedBays?.length || 0);
          
          // Log for debugging
          logBayStatus(updatedBays || []);
          
          // Update state with processed bays
          setBays(updatedBays || []);
        }
      } else {
        console.warn('No bays data to process');
        if (isMountedRef.current) {
          setBays([]);
        }
      }
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      
      // Set loading to false after a small delay
      timeoutRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          setLoading(false);
          console.log('Loading state set to false');
        }
      }, 300);
      
    } catch (error) {
      console.error('Error in fetchBays:', error);
      if (isMountedRef.current) {
        setLoading(false);
        setBays([]); // Ensure we have an empty array rather than undefined
        toast({
          title: 'Error',
          description: 'Failed to load bays data. Please try again.',
          variant: 'destructive',
        });
      }
    }
  }, [fetchBayData, userNames, user, today, currentDayOfWeek, toast]);
  
  // Set up real-time subscriptions
  useSupabaseSubscription(
    [
      { table: 'daily_claims' },
      { table: 'permanent_assignments' },
      { table: 'bays' }
    ],
    fetchBays
  );

  // Initial fetch on component mount
  useEffect(() => {
    console.log('Bays component mounted, fetching data...');
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
