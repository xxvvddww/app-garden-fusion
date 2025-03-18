
import { useCallback, useEffect, useRef } from 'react';
import { useToast } from "@/components/ui/use-toast";
import { useSupabaseSubscription } from './useSupabaseSubscription';
import { useBayAssignmentsData } from './useBayAssignmentsData';

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
  const { toast } = useToast();
  const isMountedRef = useRef(true);
  const { 
    reservations, 
    loading, 
    refreshing, 
    setRefreshing, 
    fetchAssignments 
  } = useBayAssignmentsData();
  
  // Use our custom hook for Supabase subscriptions
  useSupabaseSubscription(
    [
      { table: 'daily_claims' },
      { table: 'permanent_assignments' },
      { table: 'bays' }
    ],
    fetchAssignments
  );
  
  const handleRefresh = useCallback(() => {
    if (isMountedRef.current) {
      setRefreshing(true);
      fetchAssignments();
    }
  }, [fetchAssignments, setRefreshing]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Initial fetch
    fetchAssignments().catch(error => {
      console.error('Error in initial fetch:', error);
      if (isMountedRef.current) {
        toast({
          title: 'Error',
          description: 'Failed to load bay assignments',
          variant: 'destructive',
        });
      }
    });
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchAssignments, toast]);

  return {
    reservations,
    loading,
    refreshing,
    handleRefresh
  };
};
