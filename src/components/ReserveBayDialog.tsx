
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Bay } from '@/types';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ReserveBayDialogProps {
  bay: Bay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const ReserveBayDialog = ({ bay, open, onOpenChange, onSuccess }: ReserveBayDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [isReservedByYou, setIsReservedByYou] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');
  const currentDayOfWeek = format(new Date(), 'EEEE'); // Returns day name like "Monday"

  useEffect(() => {
    if (bay && open) {
      checkBayAvailability();
    }
  }, [bay, open]);

  const checkBayAvailability = async () => {
    if (!bay || !user) return;
    
    try {
      setCheckingAvailability(true);
      
      // First check if bay is under maintenance
      if (bay.status === 'Maintenance') {
        setIsAvailable(false);
        setIsReservedByYou(false);
        setUnavailableReason('This bay is currently under maintenance.');
        return;
      }
      
      // Check daily claims
      const { data: dailyClaims, error: claimsError } = await supabase
        .from('daily_claims')
        .select('user_id, status')
        .eq('bay_id', bay.bay_id)
        .eq('claim_date', today);
      
      if (claimsError) throw claimsError;
      
      // Filter for active claims only
      const activeClaims = dailyClaims.filter(claim => claim.status === 'Active');
      
      if (activeClaims.length > 0) {
        const isClaimedByCurrentUser = activeClaims.some(claim => claim.user_id === user.user_id);
        
        if (isClaimedByCurrentUser) {
          setIsAvailable(false);
          setIsReservedByYou(true);
          setUnavailableReason('You have already reserved this bay for today.');
        } else {
          setIsAvailable(false);
          setIsReservedByYou(false);
          setUnavailableReason('This bay has already been reserved for today.');
        }
        return;
      }
      
      // Check permanent assignments
      const { data: permanentAssignments, error: assignmentsError } = await supabase
        .from('permanent_assignments')
        .select('user_id')
        .eq('bay_id', bay.bay_id)
        .or(`day_of_week.eq.${currentDayOfWeek},day_of_week.eq.All Days`);
      
      if (assignmentsError) throw assignmentsError;
      
      if (permanentAssignments.length > 0) {
        const isAssignedToCurrentUser = permanentAssignments.some(assignment => assignment.user_id === user.user_id);
        
        if (isAssignedToCurrentUser) {
          // Check if there's a cancelled claim for today
          const hasCancelledClaim = dailyClaims.some(
            claim => claim.user_id === user.user_id && claim.status === 'Cancelled'
          );
          
          if (hasCancelledClaim) {
            setIsAvailable(true);
            setIsReservedByYou(false);
            setUnavailableReason('');
          } else {
            setIsAvailable(false);
            setIsReservedByYou(true);
            setUnavailableReason('This bay is already permanently assigned to you.');
          }
        } else {
          setIsAvailable(false);
          setIsReservedByYou(false);
          setUnavailableReason('This bay is permanently assigned to another user.');
        }
        return;
      }
      
      // Bay is available
      setIsAvailable(true);
      setIsReservedByYou(false);
      setUnavailableReason('');
      
    } catch (error) {
      console.error('Error checking bay availability:', error);
      toast({
        title: 'Error',
        description: 'Failed to check bay availability.',
        variant: 'destructive',
      });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleReserve = async () => {
    if (!bay || !user) return;
    
    try {
      setLoading(true);
      
      // Create daily claim
      const { error: claimError } = await supabase
        .from('daily_claims')
        .insert({
          bay_id: bay.bay_id,
          user_id: user.user_id,
          claim_date: today,
          status: 'Active',
          created_by: user.user_id
        });
      
      if (claimError) throw claimError;
      
      toast({
        title: 'Bay Reserved',
        description: `You have successfully reserved bay ${bay.bay_number} for today.`,
      });
      
      onOpenChange(false);
      if (onSuccess) onSuccess();
      
    } catch (error) {
      console.error('Error reserving bay:', error);
      toast({
        title: 'Reservation failed',
        description: 'There was an error reserving the bay. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnreserve = async () => {
    if (!bay || !user || !isReservedByYou) return;
    
    try {
      setLoading(true);
      
      console.log(`Attempting to unreserve bay ${bay.bay_id} for user ${user.user_id} on ${today}`);
      
      // First check if this is a permanent assignment that we need to cancel for today
      const { data: permanentAssignments, error: assignmentError } = await supabase
        .from('permanent_assignments')
        .select('assignment_id')
        .eq('bay_id', bay.bay_id)
        .eq('user_id', user.user_id)
        .or(`day_of_week.eq.${currentDayOfWeek},day_of_week.eq.All Days`);
      
      if (assignmentError) throw assignmentError;
      
      if (permanentAssignments.length > 0) {
        console.log('This is a permanent assignment, creating a cancellation record');
        
        // Check if there's already a cancelled claim for today
        const { data: existingClaims, error: checkError } = await supabase
          .from('daily_claims')
          .select('claim_id, status')
          .eq('bay_id', bay.bay_id)
          .eq('user_id', user.user_id)
          .eq('claim_date', today);
        
        if (checkError) throw checkError;
        
        if (existingClaims.length > 0) {
          // If there's an existing claim that's active, update it to cancelled
          const activeClaim = existingClaims.find(claim => claim.status === 'Active');
          
          if (activeClaim) {
            console.log(`Updating existing claim ${activeClaim.claim_id} to Cancelled`);
            
            const { error: updateError } = await supabase
              .from('daily_claims')
              .update({ status: 'Cancelled' })
              .eq('claim_id', activeClaim.claim_id)
              .eq('user_id', user.user_id);
            
            if (updateError) throw updateError;
          } else {
            // If there's no active claim but there is a cancelled one, no action needed
            console.log('Bay is already cancelled for today');
          }
        } else {
          // Create a new cancelled claim
          console.log('Creating new cancelled claim for permanent assignment');
          
          const { error: insertError } = await supabase
            .from('daily_claims')
            .insert({
              bay_id: bay.bay_id,
              user_id: user.user_id,
              claim_date: today,
              status: 'Cancelled',
              created_by: user.user_id
            });
          
          if (insertError) throw insertError;
        }
      } else {
        // This is a daily claim, so we need to find and cancel it
        console.log('This is a daily claim, finding and updating it');
        
        const { data: existingClaims, error: fetchError } = await supabase
          .from('daily_claims')
          .select('claim_id')
          .eq('bay_id', bay.bay_id)
          .eq('user_id', user.user_id)
          .eq('claim_date', today)
          .eq('status', 'Active');
        
        if (fetchError) throw fetchError;
        
        if (existingClaims.length > 0) {
          console.log(`Updating claim ${existingClaims[0].claim_id} to Cancelled`);
          
          const { error: updateError } = await supabase
            .from('daily_claims')
            .update({ status: 'Cancelled' })
            .eq('claim_id', existingClaims[0].claim_id)
            .eq('user_id', user.user_id);
          
          if (updateError) throw updateError;
        } else {
          console.log('No active claim found to cancel');
          throw new Error('No active reservation found');
        }
      }
      
      toast({
        title: 'Bay Released',
        description: `You have successfully released bay ${bay.bay_number} for today.`,
      });
      
      onOpenChange(false);
      if (onSuccess) onSuccess();
      
    } catch (error) {
      console.error('Error unreserving bay:', error);
      toast({
        title: 'Release failed',
        description: 'There was an error releasing the bay. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  if (!bay) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isReservedByYou ? 'Release Parking Bay' : 'Reserve Parking Bay'}
          </DialogTitle>
          <DialogDescription>
            Bay {bay.bay_number} - {bay.location}
          </DialogDescription>
        </DialogHeader>
        
        {checkingAvailability ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2">Checking availability...</span>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {!isAvailable && !isReservedByYou ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {unavailableReason}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4" />
                  <span>Date: {today}</span>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-md text-sm">
                  {isReservedByYou ? (
                    <p>This bay is currently reserved by you. You can release it to make it available for others.</p>
                  ) : (
                    <p>Once reserved, this bay will be assigned to you for the rest of the day.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {isReservedByYou ? (
            <Button
              onClick={handleUnreserve}
              disabled={loading || checkingAvailability}
              variant="destructive"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Releasing...
                </>
              ) : (
                'Release Bay'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleReserve}
              disabled={loading || !isAvailable || checkingAvailability}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reserving...
                </>
              ) : (
                'Reserve Bay'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReserveBayDialog;
