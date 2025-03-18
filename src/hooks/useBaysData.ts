
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
      setLoading(true);
      
      // Fetch all required data from Supabase
      const { baysData, dailyClaimsData, permanentAssignmentsData } = await fetchBayData();
      
      if (!isMountedRef.current) return;
      
      // Process the bay data
      const updatedBays = processBayData(
        baysData, 
        dailyClaimsData, 
        permanentAssignmentsData,
        userNames,
        user?.user_id,
        today,
        currentDayOfWeek
      );
      
      if (isMountedRef.current) {
        // Log for debugging
        logBayStatus(updatedBays);
        
        // Update state with processed bays
        setBays(updatedBays as Bay[]);
        
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
        }
        
        // Add a small delay before finishing loading to prevent UI flicker
        timeoutRef.current = window.setTimeout(() => {
          if (isMountedRef.current) {
            setLoading(false);
          }
        }, 300);
      }
    } catch (error) {
      console.error('Error in fetchBays:', error);
      if (isMountedRef.current) {
        setLoading(false);
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
