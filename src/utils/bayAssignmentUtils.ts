
import { format } from 'date-fns';
import { BayReservation } from '@/hooks/useBayAssignments';

/**
 * Processes raw data from database into BayReservation objects
 */
export const processBayAssignments = (
  baysData: any[], 
  permanentData: any[], 
  dailyData: any[],
  userNames: Record<string, string>,
  currentDayOfWeek: string,
  today: string
): BayReservation[] => {
  // Create map of daily claims by bay_id
  const dailyClaimsByBay = new Map<string, any[]>();
  dailyData.forEach(claim => {
    if (!dailyClaimsByBay.has(claim.bay_id)) {
      dailyClaimsByBay.set(claim.bay_id, []);
    }
    dailyClaimsByBay.get(claim.bay_id)?.push(claim);
  });
  
  const allReservations: BayReservation[] = [];
  
  // Add ALL permanent assignments regardless of day, to show the full schedule
  permanentData.forEach(pa => {
    const bayNumber = baysData.find(b => b.bay_id === pa.bay_id)?.bay_number;
    
    if (bayNumber) {
      // Check if this is for today's day of week
      const isForToday = pa.day_of_week === currentDayOfWeek || pa.day_of_week === 'All Days';
      
      // Check if temporarily available for today based on date range
      const isTemporarilyAvailable = 
        pa.available_from && pa.available_to && 
        today >= pa.available_from && today <= pa.available_to;
        
      // Check if there's a cancellation for today
      const dailyClaims = dailyClaimsByBay.get(pa.bay_id) || [];
      const cancelledForToday = isForToday && dailyClaims.some(
        claim => claim.user_id === pa.user_id && claim.status === 'Cancelled'
      );
      
      if (isForToday && isTemporarilyAvailable) {
        allReservations.push({
          bay_id: pa.bay_id,
          bay_number: bayNumber,
          reservation_type: 'Permanent',
          day_or_date: pa.day_of_week,
          user_name: userNames[pa.user_id] || 'Unknown',
          status: `Temporarily available (${pa.available_from} to ${pa.available_to})`,
          assignment_id: pa.assignment_id
        });
      } else if (isForToday && cancelledForToday) {
        allReservations.push({
          bay_id: pa.bay_id,
          bay_number: bayNumber,
          reservation_type: 'Permanent',
          day_or_date: pa.day_of_week,
          user_name: userNames[pa.user_id] || 'Unknown',
          status: 'Cancelled for today',
          assignment_id: pa.assignment_id
        });
      } else {
        // Show regular permanent assignment with appropriate status
        allReservations.push({
          bay_id: pa.bay_id,
          bay_number: bayNumber,
          reservation_type: 'Permanent',
          day_or_date: pa.day_of_week,
          user_name: userNames[pa.user_id] || 'Unknown',
          status: isForToday ? 'Active' : 'Scheduled',
          assignment_id: pa.assignment_id
        });
      }
    }
  });
  
  // Add daily claims
  dailyData.forEach(dc => {
    // Show all daily claims, both active and cancelled
    const bayNumber = baysData.find(b => b.bay_id === dc.bay_id)?.bay_number;
    
    if (bayNumber) {
      // For daily claims, we want to show both active and cancelled
      allReservations.push({
        bay_id: dc.bay_id,
        bay_number: bayNumber,
        reservation_type: 'Daily',
        day_or_date: dc.claim_date,
        user_name: userNames[dc.user_id] || 'Unknown',
        status: dc.status,
        claim_id: dc.claim_id
      });
    }
  });
  
  // Sort by bay number
  return allReservations.sort((a, b) => a.bay_number - b.bay_number);
};

/**
 * Extracts all user IDs from assignment data
 */
export const extractUserIds = (permanentData: any[], dailyData: any[]): Set<string> => {
  const userIds = new Set<string>();
  permanentData.forEach(pa => userIds.add(pa.user_id));
  dailyData.forEach(dc => userIds.add(dc.user_id));
  return userIds;
};
