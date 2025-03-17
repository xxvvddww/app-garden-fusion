
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Bay } from '@/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { format, addDays, eachDayOfInterval, parse } from 'date-fns';
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
      
      let fromDate: string;
      let toDate: string;
      const now = new Date();
      
      // Determine the date range based on the selected option
      if (availabilityOption === 'today') {
        fromDate = format(now, 'yyyy-MM-dd');
        toDate = fromDate;
      } else if (availabilityOption === 'tomorrow') {
        fromDate = format(addDays(now, 1), 'yyyy-MM-dd');
        toDate = fromDate;
      } else if (availabilityOption === 'custom') {
        if (startDate && !endDate) {
          // Single date selected
          fromDate = format(startDate, 'yyyy-MM-dd');
          toDate = fromDate;
        } else if (startDate && endDate) {
          // Date range selected
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
      } else {
        toast({
          title: 'Error',
          description: 'Please select a valid date option',
          variant: 'destructive',
        });
        return;
      }
      
      console.log(`Making bay available from ${fromDate} to ${toDate}`);
      
      // First, get all permanent assignments for this bay by this user
      const { data: permanentAssignments, error: fetchError } = await supabase
        .from('permanent_assignments')
        .select('*')
        .eq('bay_id', bay.bay_id)
        .eq('user_id', user.user_id);
      
      if (fetchError) {
        console.error('Error fetching permanent assignments:', fetchError);
        throw fetchError;
      }
      
      console.log('Permanent assignments found:', permanentAssignments);
      
      if (!permanentAssignments || permanentAssignments.length === 0) {
        toast({
          title: 'Error',
          description: 'No permanent assignments found for this bay',
          variant: 'destructive',
        });
        return;
      }
      
      // Update each permanent assignment with the availability date range
      for (const assignment of permanentAssignments) {
        console.log(`Updating assignment ${assignment.assignment_id} with availability dates:`, { 
          available_from: fromDate, 
          available_to: toDate 
        });
        
        const { error: updateError } = await supabase
          .from('permanent_assignments')
          .update({
            available_from: fromDate,
            available_to: toDate
          })
          .eq('assignment_id', assignment.assignment_id);
        
        if (updateError) {
          console.error('Error updating permanent assignment:', updateError);
          throw updateError;
        }
      }
      
      // For the selected dates, we also need to create cancelled daily claims
      // to ensure they show up correctly in the UI immediately
      const dateRange = startDate && endDate 
        ? eachDayOfInterval({ start: startDate, end: endDate })
        : [availabilityOption === 'today' ? now : addDays(now, 1)];
      
      for (const date of dateRange) {
        const formattedDate = format(date, 'yyyy-MM-dd');
        console.log(`Creating cancelled claim for ${formattedDate}`);
        
        // Check if a claim already exists for this date
        const { data: existingClaims, error: claimsError } = await supabase
          .from('daily_claims')
          .select('*')
          .eq('bay_id', bay.bay_id)
          .eq('user_id', user.user_id)
          .eq('claim_date', formattedDate);
        
        if (claimsError) {
          console.error('Error checking existing claims:', claimsError);
          throw claimsError;
        }
        
        // If a claim exists, update it to cancelled, otherwise create a new cancelled claim
        if (existingClaims && existingClaims.length > 0) {
          const { error: updateError } = await supabase
            .from('daily_claims')
            .update({ status: 'Cancelled' })
            .eq('claim_id', existingClaims[0].claim_id);
          
          if (updateError) {
            console.error('Error updating claim:', updateError);
            throw updateError;
          }
        } else {
          const { error: insertError } = await supabase
            .from('daily_claims')
            .insert({
              bay_id: bay.bay_id,
              user_id: user.user_id,
              claim_date: formattedDate,
              status: 'Cancelled',
              created_by: user.user_id
            });
          
          if (insertError) {
            console.error('Error inserting claim:', insertError);
            throw insertError;
          }
        }
      }
      
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
