
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PermanentAssignment, Bay, castToPermanentAssignmentWithBay, DailyClaim, castToDailyClaim } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import BayCard from '@/components/BayCard';
import { AlertCircle } from 'lucide-react';
import MakeBayAvailableDialog from '@/components/MakeBayAvailableDialog';
import { format } from 'date-fns';

const MyBay = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<(PermanentAssignment & { bay: Bay })[]>([]);
  const [dailyClaims, setDailyClaims] = useState<DailyClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const { toast } = useToast();
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (user) {
      fetchUserAssignments();
      fetchUserDailyClaims();
    }
  }, [user]);

  const fetchUserAssignments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('permanent_assignments')
        .select(`
          *,
          bay:bay_id(*)
        `)
        .eq('user_id', user?.user_id);

      if (error) throw error;
      
      const typedAssignments = (data || []).map(castToPermanentAssignmentWithBay);
      
      setAssignments(typedAssignments);
    } catch (error) {
      console.error('Error fetching user assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your bay assignments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDailyClaims = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_claims')
        .select('*')
        .eq('user_id', user?.user_id)
        .eq('status', 'Active');

      if (error) throw error;
      
      const typedClaims = (data || []).map(castToDailyClaim);
      setDailyClaims(typedClaims);
    } catch (error) {
      console.error('Error fetching user daily claims:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your daily bay claims',
        variant: 'destructive',
      });
    }
  };

  const getMyBays = () => {
    const uniqueBaysMap = new Map<string, Bay>();
    const today = format(new Date(), 'yyyy-MM-dd');
    const currentDayOfWeek = format(new Date(), 'EEEE'); // Returns day name like "Monday"
    
    assignments.forEach(assignment => {
      if ((assignment.day_of_week === currentDayOfWeek || assignment.day_of_week === 'All Days')) {
        const isTemporarilyAvailable = assignment.available_from && assignment.available_to && 
                           today >= assignment.available_from && today <= assignment.available_to;
        
        if (!isTemporarilyAvailable) {
          if (!uniqueBaysMap.has(assignment.bay.bay_id)) {
            const hasCancelledClaim = dailyClaims.some(
              claim => claim.bay_id === assignment.bay.bay_id && 
                      claim.claim_date === today && 
                      claim.status === 'Cancelled'
            );
            
            if (!hasCancelledClaim) {
              uniqueBaysMap.set(assignment.bay.bay_id, {
                ...assignment.bay,
                status: 'Reserved' as Bay['status'],
                reserved_by_you: true
              });
            }
          }
        } else {
          console.log(`Bay ${assignment.bay.bay_number} is temporarily available from ${assignment.available_from} to ${assignment.available_to}`);
          // Don't show temporarily available bays in MyBay
        }
      }
    });
    
    dailyClaims.forEach(claim => {
      if (claim.status === 'Active') {
        const matchingBay = assignments.find(a => a.bay.bay_id === claim.bay_id)?.bay;
        if (matchingBay && !uniqueBaysMap.has(matchingBay.bay_id)) {
          uniqueBaysMap.set(matchingBay.bay_id, {
            ...matchingBay,
            status: 'Reserved' as Bay['status'],
            reserved_by_you: true
          });
        }
      }
    });
    
    return Array.from(uniqueBaysMap.values());
  };

  const handleBayClick = (bay: Bay) => {
    setSelectedBay(bay);
    setAvailabilityDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-6">
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  const myBays = getMyBays();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Bay</h1>
      
      {myBays.length === 0 ? (
        <Card>
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-center text-muted-foreground mb-4">
              You don't have any assigned parking bays
            </p>
            <Button variant="outline" className="w-64" onClick={() => window.location.href = '/bays'}>
              Find Available Bay
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {myBays.map(bay => (
            <BayCard 
              key={bay.bay_id} 
              bay={bay}
              onClick={handleBayClick}
            />
          ))}
        </div>
      )}
      
      <MakeBayAvailableDialog 
        bay={selectedBay}
        open={availabilityDialogOpen}
        onOpenChange={setAvailabilityDialogOpen}
        onSuccess={() => {
          fetchUserAssignments();
          fetchUserDailyClaims();
        }}
      />
    </div>
  );
};

export default MyBay;
