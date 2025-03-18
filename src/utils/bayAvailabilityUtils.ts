
import { format, addDays, eachDayOfInterval } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Bay } from '@/types';

type AvailabilityOption = 'today' | 'tomorrow' | 'custom';

interface MakeBayAvailableParams {
  bay: Bay;
  userId: string;
  availabilityOption: AvailabilityOption;
  startDate?: Date;
  endDate?: Date;
}

export const makeBayAvailable = async ({
  bay,
  userId,
  availabilityOption,
  startDate,
  endDate
}: MakeBayAvailableParams) => {
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
      throw new Error('Please select valid date(s)');
    }
  } else {
    throw new Error('Please select a valid date option');
  }
  
  console.log(`Making bay available from ${fromDate} to ${toDate}`);
  
  // First, get all permanent assignments for this bay by this user
  const { data: permanentAssignments, error: fetchError } = await supabase
    .from('permanent_assignments')
    .select('*')
    .eq('bay_id', bay.bay_id)
    .eq('user_id', userId);
  
  if (fetchError) {
    console.error('Error fetching permanent assignments:', fetchError);
    throw fetchError;
  }
  
  console.log('Permanent assignments found:', permanentAssignments);
  
  if (!permanentAssignments || permanentAssignments.length === 0) {
    throw new Error('No permanent assignments found for this bay');
  }
  
  // Update each permanent assignment with the availability date range
  for (const assignment of permanentAssignments) {
    console.log(`Updating assignment ${assignment.assignment_id} with availability dates:`, { 
      available_from: fromDate, 
      available_to: toDate 
    });
    
    // Explicitly set the data type for the columns to ensure proper formatting
    const { data: updateData, error: updateError } = await supabase
      .from('permanent_assignments')
      .update({
        available_from: fromDate,
        available_to: toDate
      })
      .eq('assignment_id', assignment.assignment_id)
      .select();
    
    if (updateError) {
      console.error('Error updating permanent assignment:', updateError);
      throw updateError;
    }
    
    console.log('Update response:', updateData);
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
      .eq('user_id', userId)
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
          user_id: userId,
          claim_date: formattedDate,
          status: 'Cancelled',
          created_by: userId
        });
      
      if (insertError) {
        console.error('Error inserting claim:', insertError);
        throw insertError;
      }
    }
  }
  
  // Verify the updates were made successfully
  const { data: verifyAssignments, error: verifyError } = await supabase
    .from('permanent_assignments')
    .select('*')
    .eq('bay_id', bay.bay_id)
    .eq('user_id', userId);
    
  if (verifyError) {
    console.error('Error verifying assignments:', verifyError);
  } else {
    console.log('Verified assignments after update:', verifyAssignments);
  }
  
  return {
    fromDate,
    toDate,
    now
  };
};
