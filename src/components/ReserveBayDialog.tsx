
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
        setUnavailableReason('This bay is currently under maintenance.');
        return;
      }
      
      // Check daily claims
      const { data: dailyClaims, error: claimsError } = await supabase
        .from('daily_claims')
        .select('user_id')
        .eq('bay_id', bay.bay_id)
        .eq('claim_date', today)
        .eq('status', 'Active');
      
      if (claimsError) throw claimsError;
      
      if (dailyClaims.length > 0) {
        const isClaimedByCurrentUser = dailyClaims.some(claim => claim.user_id === user.user_id);
        
        if (isClaimedByCurrentUser) {
          setIsAvailable(false);
          setUnavailableReason('You have already reserved this bay for today.');
        } else {
          setIsAvailable(false);
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
          setIsAvailable(false);
          setUnavailableReason('This bay is already permanently assigned to you.');
        } else {
          setIsAvailable(false);
          setUnavailableReason('This bay is permanently assigned to another user.');
        }
        return;
      }
      
      // Bay is available
      setIsAvailable(true);
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
    if (!bay || !user || !isAvailable) return;
    
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
      
      // Update bay status to Reserved
      const { error: bayError } = await supabase
        .from('bays')
        .update({ 
          status: 'Reserved' as Bay['status'],
          updated_by: user.user_id
        })
        .eq('bay_id', bay.bay_id);
      
      if (bayError) throw bayError;
      
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
  
  if (!bay) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reserve Parking Bay</DialogTitle>
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
            {!isAvailable ? (
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
                  <span>Reservation date: {today}</span>
                </div>
                
                <div className="bg-muted/50 p-3 rounded-md text-sm">
                  <p>Once reserved, this bay will be assigned to you for the rest of the day.</p>
                </div>
              </>
            )}
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReserveBayDialog;
