
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import BayCard from '@/components/BayCard';
import { CheckCircle, Calendar as CalendarIcon } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState('permanent');
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
  const getUniqueBays = (assignments: (PermanentAssignment & { bay: Bay })[]) => {
    const uniqueBaysMap = new Map<string, Bay>();
    
    assignments.forEach(assignment => {
      if (!uniqueBaysMap.has(assignment.bay.bay_id)) {
        uniqueBaysMap.set(assignment.bay.bay_id, {
          ...assignment.bay,
          status: 'Reserved' as Bay['status'],
          reserved_by_you: true
        });
      }
    });
    
    return Array.from(uniqueBaysMap.values());
  };

  // Get unique bays from daily claims
  const getUniqueDailyClaimBays = () => {
    const uniqueBaysMap = new Map<string, Bay>();
    
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
      
      // Create a temporary claim in the daily_claims table, marking bay as Available
      for (const date of dates) {
        // First check if there's an existing claim for this date
        const { data: existingClaims } = await supabase
          .from('daily_claims')
          .select('*')
          .eq('bay_id', selectedBay.bay_id)
          .eq('claim_date', date)
          .eq('user_id', user.user_id);
        
        // If a claim exists, update its status to 'Cancelled'
        if (existingClaims && existingClaims.length > 0) {
          const { error: updateError } = await supabase
            .from('daily_claims')
            .update({ status: 'Cancelled' })
            .eq('claim_id', existingClaims[0].claim_id);
          
          if (updateError) throw updateError;
        } else {
          // If no claim exists, create a new one with 'Cancelled' status
          // This will signal that the user has made their bay available for this date
          const { error: insertError } = await supabase
            .from('daily_claims')
            .insert({
              bay_id: selectedBay.bay_id,
              user_id: user.user_id,
              claim_date: date,
              status: 'Cancelled',
              created_by: user.user_id
            });
          
          if (insertError) throw insertError;
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
        description: 'Failed to update bay status',
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

  const uniquePermanentBays = getUniqueBays(assignments);
  const uniqueDailyBays = getUniqueDailyClaimBays();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Bay</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="permanent">Permanent Assignments</TabsTrigger>
          <TabsTrigger value="daily">Daily Claims</TabsTrigger>
        </TabsList>
        
        <TabsContent value="permanent" className="space-y-6">
          {uniquePermanentBays.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground py-4">
                  You don't have any permanently assigned parking bays
                </p>
                <Button variant="outline" className="w-full">Request Permanent Bay</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {uniquePermanentBays.map(bay => (
                <BayCard 
                  key={bay.bay_id} 
                  bay={bay}
                  onClick={handleBayClick}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="daily" className="space-y-6">
          {uniqueDailyBays.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground py-4">
                  You don't have any active daily bay claims
                </p>
                <Button variant="outline" className="w-full">Find Available Bay</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {uniqueDailyBays.map(bay => (
                <BayCard 
                  key={bay.bay_id} 
                  bay={bay}
                  onClick={handleBayClick}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
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
              {isSubmitting ? 'Processing...' : 'Make Available'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyBay;
