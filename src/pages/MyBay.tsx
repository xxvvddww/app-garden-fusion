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

  const getMyBays = () => {
    const uniqueBaysMap = new Map<string, Bay>();
    const today = format(new Date(), 'yyyy-MM-dd');
    const currentDayOfWeek = format(new Date(), 'EEEE'); // Returns day name like "Monday"
    
    assignments.forEach(assignment => {
      if ((assignment.day_of_week === currentDayOfWeek || assignment.day_of_week === 'All Days') && 
          !(assignment.available_from && assignment.available_to && 
            today >= assignment.available_from && today <= assignment.available_to)) {
        
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
    setAvailabilityOption('today');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const makeAvailable = async () => {
    if (!selectedBay || !user) return;
    
    try {
      setIsSubmitting(true);
      
      let fromDate: string | undefined;
      let toDate: string | undefined;
      const now = new Date();
      
      if (availabilityOption === 'today') {
        fromDate = format(now, 'yyyy-MM-dd');
        toDate = fromDate;
      } else if (availabilityOption === 'tomorrow') {
        fromDate = format(addDays(now, 1), 'yyyy-MM-dd');
        toDate = fromDate;
      } else if (availabilityOption === 'custom') {
        if (startDate && !endDate) {
          fromDate = format(startDate, 'yyyy-MM-dd');
          toDate = fromDate;
        } else if (startDate && endDate) {
          fromDate = format(startDate, 'yyyy-MM-dd');
          toDate = format(endDate, 'yyyy-MM-dd');
        } else {
          toast({
            title: 'Error',
            description: 'Please select valid date(s)',
            variant: 'destructive',
          });
          return;
        }
      }
      
      if (!fromDate || !toDate) {
        toast({
          title: 'Error',
          description: 'Please select a valid date range',
          variant: 'destructive',
        });
        return;
      }
      
      console.log('Making bay available from', fromDate, 'to', toDate);
      
      const { data: userAssignments, error: assignmentsError } = await supabase
        .from('permanent_assignments')
        .select('*')
        .eq('bay_id', selectedBay.bay_id)
        .eq('user_id', user.user_id);
      
      if (assignmentsError) {
        console.error('Error fetching user assignments:', assignmentsError);
        throw assignmentsError;
      }
      
      for (const assignment of userAssignments) {
        const { error: updateError } = await supabase
          .from('permanent_assignments')
          .update({
            available_from: fromDate,
            available_to: toDate
          })
          .eq('assignment_id', assignment.assignment_id);
        
        if (updateError) {
          console.error('Error updating assignment:', updateError);
          throw updateError;
        }
      }
      
      const dateRange = startDate && endDate 
        ? eachDayOfInterval({ start: startDate, end: endDate })
        : [availabilityOption === 'today' ? now : addDays(now, 1)];
      
      for (const date of dateRange) {
        const formattedDate = format(date, 'yyyy-MM-dd');
        
        const { data: existingClaims, error: fetchError } = await supabase
          .from('daily_claims')
          .select('*')
          .eq('bay_id', selectedBay.bay_id)
          .eq('claim_date', formattedDate)
          .eq('user_id', user.user_id);
        
        if (fetchError) {
          console.error('Error fetching existing claims:', fetchError);
          throw fetchError;
        }
        
        if (existingClaims && existingClaims.length > 0) {
          const { error: updateError } = await supabase
            .from('daily_claims')
            .update({ status: 'Cancelled' })
            .eq('claim_id', existingClaims[0].claim_id)
            .eq('user_id', user.user_id);
          
          if (updateError) {
            console.error('Error updating claim status:', updateError);
            throw updateError;
          }
        } else {
          const newClaim = {
            bay_id: selectedBay.bay_id,
            user_id: user.user_id,
            claim_date: formattedDate,
            status: 'Cancelled',
            created_by: user.user_id
          };
          
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
        description: `Your bay has been marked as available ${
          fromDate === toDate 
            ? `for ${fromDate === format(now, 'yyyy-MM-dd') ? 'today' : fromDate}` 
            : `from ${fromDate} to ${toDate}`
        }`,
        variant: 'default',
      });
      
      setAvailabilityDialogOpen(false);
      await Promise.all([fetchUserAssignments(), fetchUserDailyClaims()]);
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
