
import { useState } from 'react';
import { Bay } from '@/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import DateSelector from './bay-available/DateSelector';
import { makeBayAvailable } from '@/utils/bayAvailabilityUtils';

interface MakeBayAvailableDialogProps {
  bay: Bay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const MakeBayAvailableDialog = ({ 
  bay, 
  open, 
  onOpenChange,
  onSuccess 
}: MakeBayAvailableDialogProps) => {
  const { user } = useAuth();
  const [availabilityOption, setAvailabilityOption] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const makeAvailable = async () => {
    if (!bay || !user) return;
    
    try {
      setIsSubmitting(true);
      
      const { fromDate, toDate, now } = await makeBayAvailable({
        bay,
        userId: user.user_id,
        availabilityOption,
        startDate,
        endDate
      });
      
      // Force a refresh of the data after making available
      if (onSuccess) {
        onSuccess();
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
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating bay status:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update bay status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogChange = (value: boolean) => {
    if (!value) {
      // Reset state when dialog is closed
      setAvailabilityOption('today');
      setStartDate(undefined);
      setEndDate(undefined);
    }
    onOpenChange(value);
  };
  
  const handleDateRangeChange = ({ from, to }: { from: Date | undefined, to: Date | undefined }) => {
    setStartDate(from);
    setEndDate(to);
  };

  if (!bay) return null;

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Make Bay Available</DialogTitle>
          <DialogDescription>
            Choose when to make Bay {bay.bay_number} available for others to use.
          </DialogDescription>
        </DialogHeader>
        
        <DateSelector 
          availabilityOption={availabilityOption}
          setAvailabilityOption={setAvailabilityOption}
          startDate={startDate}
          endDate={endDate}
          setDateRange={handleDateRangeChange}
        />
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
  );
};

export default MakeBayAvailableDialog;
