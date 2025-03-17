
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Bay } from '@/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format, addDays, eachDayOfInterval } from 'date-fns';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';

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
        console.log(`Processing date: ${date} for bay ${bay.bay_id}`);
        
        // First check if there's an existing claim for this date
        const { data: existingClaims, error: fetchError } = await supabase
          .from('daily_claims')
          .select('*')
          .eq('bay_id', bay.bay_id)
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
          // This is crucial for permanent assignments - we need to create a cancellation record
          console.log('No existing claim found, creating new cancelled claim');
          
          const newClaim = {
            bay_id: bay.bay_id,
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
      
      // Force a refresh of the data after cancellation
      if (onSuccess) {
        // Ensure callback is executed
        onSuccess();
      }
      
      toast({
        title: 'Success',
        description: `Your bay has been marked as available for the selected ${dates.length > 1 ? 'dates' : 'date'}`,
        variant: 'default',
      });
      
      onOpenChange(false);
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

  const handleDialogChange = (value: boolean) => {
    if (!value) {
      // Reset state when dialog is closed
      setAvailabilityOption('today');
      setStartDate(undefined);
      setEndDate(undefined);
    }
    onOpenChange(value);
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
