
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PermanentAssignment, Bay, castToPermanentAssignmentWithBay, DailyClaim, castToDailyClaim } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format, addDays, isAfter, eachDayOfInterval } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import BayCard from '@/components/BayCard';
import { AlertCircle, Loader2 } from 'lucide-react';

const MyBay = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<(PermanentAssignment & { bay: Bay })[]>([]);
  const [dailyClaims, setDailyClaims] = useState<DailyClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [availabilityOption, setAvailabilityOption] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Get unique bays from assignments to avoid duplicates
  const getMyBays = () => {
    const uniqueBaysMap = new Map<string, Bay>();
    
    // Add permanent assignment bays
    assignments.forEach(assignment => {
      if (!uniqueBaysMap.has(assignment.bay.bay_id)) {
        uniqueBaysMap.set(assignment.bay.bay_id, {
          ...assignment.bay,
          status: 'Reserved' as Bay['status'],
          reserved_by_you: true
        });
      }
    });
    
    // Add daily claim bays
    dailyClaims.forEach(claim => {
      const matchingBay = assignments.find(a => a.bay.bay_id === claim.bay_id)?.bay;
      if (matchingBay && !uniqueBaysMap.has(matchingBay.bay_id)) {
        uniqueBaysMap.set(matchingBay.bay_id, {
          ...matchingBay,
          status: 'Reserved' as Bay['status'],
          reserved_by_you: true
        });
      }
    });
    
    return Array.from(uniqueBaysMap.values());
  };

  const handleBayClick = (bay: Bay) => {
    setSelectedBay(bay);
    setAvailabilityDialogOpen(true);
    setAvailabilityOption('today');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const makeAvailable = async () => {
    if (!selectedBay || !user) return;
    
    try {
      setIsSubmitting(true);
      
      let dates: string[] = [];
      const now = new Date();
      
      // Determine which dates to make available based on the selected option
      if (availabilityOption === 'today') {
        dates = [format(now, 'yyyy-MM-dd')];
      } else if (availabilityOption === 'tomorrow') {
        dates = [format(addDays(now, 1), 'yyyy-MM-dd')];
      } else if (availabilityOption === 'custom') {
        if (startDate && !endDate) {
          // Single date selected
          dates = [format(startDate, 'yyyy-MM-dd')];
        } else if (startDate && endDate) {
          // Date range selected
          // Get all dates in the range
          const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
          dates = dateRange.map(date => format(date, 'yyyy-MM-dd'));
        } else {
          toast({
            title: 'Error',
            description: 'Please select valid date(s)',
            variant: 'destructive',
          });
          return;
        }
      }
      
      if (dates.length === 0) {
        toast({
          title: 'Error',
          description: 'Please select a valid date range',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('Making bay available for dates:', dates);
      
      // Process each date in the selected range
      for (const date of dates) {
        console.log(`Processing date: ${date} for bay ${selectedBay.bay_id}`);
        
        // First check if there's an existing claim for this date
        const { data: existingClaims, error: fetchError } = await supabase
          .from('daily_claims')
          .select('*')
          .eq('bay_id', selectedBay.bay_id)
          .eq('claim_date', date)
          .eq('user_id', user.user_id);
        
        if (fetchError) {
          console.error('Error fetching existing claims:', fetchError);
          throw fetchError;
        }
        
        console.log('Existing claims found:', existingClaims);
        
        // If a claim exists, update its status to 'Cancelled'
        if (existingClaims && existingClaims.length > 0) {
          console.log(`Updating existing claim ${existingClaims[0].claim_id} to Cancelled`);
          
          const { error: updateError } = await supabase
            .from('daily_claims')
            .update({ status: 'Cancelled' })
            .eq('claim_id', existingClaims[0].claim_id)
            .eq('user_id', user.user_id); // Ensure we're only updating the user's own claims
          
          if (updateError) {
            console.error('Error updating claim status:', updateError);
            throw updateError;
          }
        } else {
          // If no claim exists, create a new one with 'Cancelled' status
          console.log('No existing claim found, creating new cancelled claim');
          
          const newClaim = {
            bay_id: selectedBay.bay_id,
            user_id: user.user_id,
            claim_date: date,
            status: 'Cancelled',
            created_by: user.user_id
          };
          
          console.log('Inserting new claim:', newClaim);
          
          const { error: insertError } = await supabase
            .from('daily_claims')
            .insert(newClaim);
          
          if (insertError) {
            console.error('Error inserting new claim:', insertError);
            throw insertError;
          }
        }
      }
      
      toast({
        title: 'Success',
        description: `Your bay has been marked as available for the selected ${dates.length > 1 ? 'dates' : 'date'}`,
        variant: 'default',
      });
      
      setAvailabilityDialogOpen(false);
      fetchUserAssignments();
      fetchUserDailyClaims();
    } catch (error) {
      console.error('Error updating bay status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update bay status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
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
      
      <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Make Bay Available</DialogTitle>
            <DialogDescription>
              Choose when to make Bay {selectedBay?.bay_number} available for others to use.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <ToggleGroup 
              type="single" 
              value={availabilityOption} 
              onValueChange={(value) => {
                if (value) {
                  setAvailabilityOption(value as 'today' | 'tomorrow' | 'custom');
                  // Reset date selections when changing options
                  setStartDate(undefined);
                  setEndDate(undefined);
                }
              }}
              className="justify-start"
            >
              <ToggleGroupItem value="today">Today</ToggleGroupItem>
              <ToggleGroupItem value="tomorrow">Tomorrow</ToggleGroupItem>
              <ToggleGroupItem value="custom">Custom Date(s)</ToggleGroupItem>
            </ToggleGroup>
            
            {availabilityOption === 'custom' && (
              <div className="border rounded-md p-2">
                <Calendar
                  mode="range"
                  selected={{
                    from: startDate,
                    to: endDate,
                  }}
                  onSelect={(range) => {
                    setStartDate(range?.from);
                    setEndDate(range?.to);
                  }}
                  initialFocus
                  disabled={(date) => date < new Date()}
                  className="pointer-events-auto"
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvailabilityDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={makeAvailable} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Make Available'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyBay;
