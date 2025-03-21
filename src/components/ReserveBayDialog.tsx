import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Bay } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import { format, addDays } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Loader2, Calendar, CheckCircle2, XCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

interface ReserveBayDialogProps {
  bay: Bay | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  isAdmin?: boolean;
}

const ReserveBayDialog = ({ 
  bay, 
  open, 
  onOpenChange, 
  onSuccess,
  isAdmin
}: ReserveBayDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [assignmentType, setAssignmentType] = useState<'today' | 'tomorrow' | 'permanent'>('today');
  const [dayOfWeek, setDayOfWeek] = useState<string>('');
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [revokingBay, setRevokingBay] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const today = format(new Date(), 'yyyy-MM-dd');
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const currentDayOfWeek = format(new Date(), 'EEEE');
  const tomorrowDayOfWeek = format(addDays(new Date(), 1), 'EEEE');
  
  const dayOptions = [
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'All Days'
  ];

  const handleReserveBay = async () => {
    if (!bay || !user) return;
    
    try {
      setLoading(true);
      
      const { data: latestBayData, error: bayCheckError } = await supabase
        .from('bays')
        .select('*')
        .eq('bay_id', bay.bay_id)
        .single();
        
      if (bayCheckError) throw bayCheckError;
      
      const { data: recentClaims, error: claimsCheckError } = await supabase
        .from('daily_claims')
        .select('*')
        .eq('bay_id', bay.bay_id)
        .eq('claim_date', assignmentType === 'today' ? today : tomorrow)
        .eq('status', 'Active');
        
      if (claimsCheckError) throw claimsCheckError;
      
      if (latestBayData.status === 'Maintenance' || latestBayData.status === 'Reserved' || recentClaims.length > 0) {
        toast({
          title: 'Bay No Longer Available',
          description: `This bay has been ${latestBayData.status === 'Maintenance' ? 'marked as under maintenance' : 'reserved by someone else'}. Please choose another bay.`,
          variant: 'destructive',
        });
        onOpenChange(false);
        return;
      }
      
      if (assignmentType === 'today' || assignmentType === 'tomorrow') {
        const claimDate = assignmentType === 'today' ? today : tomorrow;
        
        const { error } = await supabase
          .from('daily_claims')
          .insert({
            bay_id: bay.bay_id,
            user_id: user.user_id,
            claim_date: claimDate,
            created_by: user.user_id
          });
          
        if (error) throw error;
        
        toast({
          title: 'Bay Reserved',
          description: `You have successfully reserved Bay ${bay.bay_number} for ${assignmentType === 'today' ? 'today' : 'tomorrow'}`,
        });
      } else if (assignmentType === 'permanent' && isAdmin) {
        const { error } = await supabase
          .from('permanent_assignments')
          .insert({
            bay_id: bay.bay_id,
            user_id: user.user_id,
            day_of_week: dayOfWeek,
            created_by: user.user_id
          });
          
        if (error) throw error;
        
        const { error: bayUpdateError } = await supabase
          .from('bays')
          .update({ status: 'Reserved' })
          .eq('bay_id', bay.bay_id);
          
        if (bayUpdateError) {
          console.error('Error updating bay status:', bayUpdateError);
        }
        
        toast({
          title: 'Bay Assigned',
          description: `You have successfully assigned Bay ${bay.bay_number} for every ${dayOfWeek}`,
        });
      }
      
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error reserving bay:', error);
      toast({
        title: 'Reservation Failed',
        description: 'There was an error reserving this bay. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancelReservation = async () => {
    if (!bay || !user) return;
    
    try {
      setLoading(true);
      console.log("Cancelling reservation for bay:", bay.bay_id, "User:", user.user_id, "Today:", today);
      
      if (bay.is_permanent) {
        console.log("Cancelling permanent reservation for today");
        
        const { error } = await supabase
          .from('daily_claims')
          .insert({
            bay_id: bay.bay_id,
            user_id: user.user_id,
            claim_date: today,
            status: 'Cancelled',
            created_by: user.user_id
          });
          
        if (error) {
          console.error("Error creating cancellation record:", error);
          throw error;
        }
        
        toast({
          title: 'Reservation Cancelled',
          description: `You have made Bay ${bay.bay_number} available for today`,
        });
      } else {
        console.log("Cancelling daily claim");
        
        const { data: claims, error: fetchError } = await supabase
          .from('daily_claims')
          .select('claim_id')
          .eq('bay_id', bay.bay_id)
          .eq('user_id', user.user_id)
          .eq('claim_date', today)
          .eq('status', 'Active');
          
        if (fetchError) {
          console.error("Error fetching claims to cancel:", fetchError);
          throw fetchError;
        }
        
        console.log("Found claims to cancel:", claims);
        
        if (claims && claims.length > 0) {
          const { error: updateError } = await supabase
            .from('daily_claims')
            .update({ status: 'Cancelled' })
            .eq('claim_id', claims[0].claim_id);
            
          if (updateError) {
            console.error("Error updating claim status:", updateError);
            throw updateError;
          }
          
          toast({
            title: 'Reservation Cancelled',
            description: `You have cancelled your reservation for Bay ${bay.bay_number}`,
          });
        } else {
          console.error("No active claim found to cancel");
          throw new Error("No active claim found to cancel");
        }
      }
      
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      toast({
        title: 'Cancellation Failed',
        description: 'There was an error cancelling your reservation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleAdminRevokeBay = async () => {
    if (!bay || !isAdmin) return;
    
    try {
      setRevokingBay(true);
      
      const { error: bayUpdateError } = await supabase
        .from('bays')
        .update({ status: 'Available' })
        .eq('bay_id', bay.bay_id);
        
      if (bayUpdateError) {
        console.error('Error updating bay status:', bayUpdateError);
        throw bayUpdateError;
      }
      
      console.log(`Successfully updated bay ${bay.bay_number} status to Available in database`);
      
      const { data: claimData, error: claimError } = await supabase
        .from('daily_claims')
        .select('claim_id')
        .eq('bay_id', bay.bay_id)
        .eq('claim_date', today)
        .eq('status', 'Active');
        
      if (claimError) throw claimError;
      
      if (claimData && claimData.length > 0) {
        const { error } = await supabase
          .from('daily_claims')
          .update({ status: 'Cancelled' })
          .eq('claim_id', claimData[0].claim_id);
          
        if (error) throw error;
        
        console.log(`Successfully cancelled daily claim for bay ${bay.bay_number}`);
      }
      
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('permanent_assignments')
        .select('assignment_id')
        .eq('bay_id', bay.bay_id)
        .or(`day_of_week.eq.${currentDayOfWeek},day_of_week.eq.All Days`);
        
      if (assignmentError) throw assignmentError;
      
      if (assignmentData && assignmentData.length > 0) {
        for (const assignment of assignmentData) {
          const { error } = await supabase
            .from('permanent_assignments')
            .delete()
            .eq('assignment_id', assignment.assignment_id);
            
          if (error) {
            console.error('Error deleting permanent assignment:', error);
            throw error;
          }
        }
        
        console.log(`Successfully deleted permanent assignments for bay ${bay.bay_number}`);
      }
      
      const { data: verifyBay, error: verifyError } = await supabase
        .from('bays')
        .select('status')
        .eq('bay_id', bay.bay_id)
        .single();
        
      if (verifyError) {
        console.error('Error verifying bay status:', verifyError);
      } else {
        console.log(`Verified bay ${bay.bay_number} status is now: ${verifyBay.status}`);
      }
      
      toast({
        title: 'Bay Revoked',
        description: `You have successfully revoked Bay ${bay.bay_number}`,
      });
      
      setRevokeConfirmOpen(false);
      setRevokingBay(false);
      
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
        onOpenChange(false);
      }, 10);
      
    } catch (error) {
      console.error('Error revoking bay:', error);
      toast({
        title: 'Revocation Failed',
        description: 'There was an error revoking this bay. Please try again.',
        variant: 'destructive',
      });
      setRevokingBay(false);
    }
  };

  const handleDialogOpenChange = (newOpenState: boolean) => {
    if (!newOpenState) {
      setRevokeConfirmOpen(false);
      setAssignmentType('today');
      setDayOfWeek('');
      setRevokingBay(false);
      setLoading(false);
    }
    onOpenChange(newOpenState);
  };

  if (!bay) return null;
  
  const bayIsReserved = bay.status === 'Reserved' || bay.reserved_by_you;
  
  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-[#0F1624] text-white border-[#1E2A45]">
        <DialogHeader>
          <DialogTitle className="text-xl">Bay {bay.bay_number}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {bay.location} - {bay.status}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {!bayIsReserved && bay.status === 'Available' ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium mb-3">Reservation Options:</p>
                <div className="flex w-full space-x-2">
                  <Button 
                    variant={assignmentType === 'today' ? "default" : "outline"}
                    className={`flex-1 ${assignmentType === 'today' ? '' : 'text-gray-400'}`}
                    onClick={() => setAssignmentType('today')}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Today
                  </Button>
                  <Button 
                    variant={assignmentType === 'tomorrow' ? "default" : "outline"}
                    className={`flex-1 ${assignmentType === 'tomorrow' ? '' : 'text-gray-400'}`}
                    onClick={() => setAssignmentType('tomorrow')}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Tomorrow
                  </Button>
                  {isAdmin && (
                    <Button 
                      variant={assignmentType === 'permanent' ? "default" : "outline"}
                      className={`flex-1 ${assignmentType === 'permanent' ? '' : 'text-gray-400'}`}
                      onClick={() => setAssignmentType('permanent')}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Permanent
                    </Button>
                  )}
                </div>
              </div>
              
              {assignmentType === 'permanent' && isAdmin && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Select Day:</p>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger className="w-full bg-[#162240] border-[#1E2A45] text-white">
                      <SelectValue placeholder="Select a day" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#162240] border-[#1E2A45] text-white">
                      {dayOptions.map(day => (
                        <SelectItem key={day} value={day} className="hover:bg-[#1E2A45]">
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <Button 
                className="w-full mt-4" 
                onClick={handleReserveBay}
                disabled={loading || (assignmentType === 'permanent' && !dayOfWeek)}
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
            </>
          ) : bay.reserved_by_you ? (
            <>
              <p className="text-center">
                You have reserved this bay
              </p>
              <Button 
                variant="destructive" 
                className="w-full mt-4" 
                onClick={handleCancelReservation}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancel Reservation
                  </>
                )}
              </Button>
            </>
          ) : bay.status === 'Reserved' && isAdmin ? (
            <>
              <p className="text-center">
                This bay is currently reserved.
                As an admin, you can revoke this reservation.
              </p>
              <AlertDialog open={revokeConfirmOpen} onOpenChange={setRevokeConfirmOpen}>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="w-full mt-4" 
                    disabled={revokingBay}
                  >
                    {revokingBay ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Revoking...
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-2 h-4 w-4" />
                        Revoke Bay
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#0F1624] text-white border-[#1E2A45]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke Bay Reservation</AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-400">
                      Are you sure you want to revoke this bay reservation? 
                      This will cancel today's reservation and remove any permanent assignments.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-transparent border-[#1E2A45] text-white hover:bg-[#162240]">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={(e) => {
                        e.preventDefault();
                        handleAdminRevokeBay();
                      }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Yes, Revoke Bay
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <p className="text-center">
              This bay is currently {bay.status.toLowerCase()}.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReserveBayDialog;
