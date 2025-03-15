
import { useState } from 'react';
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
import { CalendarIcon, Loader2 } from 'lucide-react';

interface ReserveBayDialogProps {
  bay: Bay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const ReserveBayDialog = ({ bay, open, onOpenChange, onSuccess }: ReserveBayDialogProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  const handleReserve = async () => {
    if (!bay || !user) return;
    
    try {
      setLoading(true);
      
      // Check if bay is available
      if (bay.status !== 'Available') {
        toast({
          title: 'Cannot reserve bay',
          description: `Bay ${bay.bay_number} is not available for reservation.`,
          variant: 'destructive',
        });
        return;
      }

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
          status: 'Reserved',
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
            You are about to reserve bay {bay.bay_number} for today.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            <CalendarIcon className="h-4 w-4" />
            <span>Reservation date: {today}</span>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-md text-sm">
            <p>Once reserved, this bay will be assigned to you for the rest of the day.</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReserve} disabled={loading || bay.status !== 'Available'}>
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
