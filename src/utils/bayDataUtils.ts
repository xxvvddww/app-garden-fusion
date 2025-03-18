
import { Bay, castToBay } from '@/types';

/**
 * Process bay data and apply statuses based on assignments and claims
 */
export const processBayData = (
  baysData: any[],
  dailyClaimsData: any[],
  permanentAssignmentsData: any[],
  userNames: {[key: string]: string},
  currentUserId: string | undefined,
  today: string,
  currentDayOfWeek: string
): Bay[] => {
  if (!baysData || !Array.isArray(baysData) || baysData.length === 0) {
    console.error('Invalid or missing bays data:', baysData);
    return [];
  }

  // Create maps for easier lookup
  const activeDailyClaimsMap = new Map();
  const cancelledDailyClaimsMap = new Map();
  const permanentAssignmentsMap = new Map();
  const temporarilyAvailableBays = new Map();
  
  // Process daily claims
  if (dailyClaimsData && Array.isArray(dailyClaimsData)) {
    dailyClaimsData.forEach(claim => {
      if (!claim || !claim.bay_id) return;

      if (claim.status === 'Active') {
        activeDailyClaimsMap.set(claim.bay_id, claim.user_id);
      } else if (claim.status === 'Cancelled') {
        if (!cancelledDailyClaimsMap.has(claim.bay_id)) {
          cancelledDailyClaimsMap.set(claim.bay_id, new Set());
        }
        cancelledDailyClaimsMap.get(claim.bay_id).add(claim.user_id);
      }
    });
  }
  
  // Process permanent assignments
  if (permanentAssignmentsData && Array.isArray(permanentAssignmentsData)) {
    permanentAssignmentsData.forEach(assignment => {
      if (!assignment || !assignment.bay_id) return;

      // Check if bay is temporarily made available
      const isTemporarilyAvailable = 
        assignment.available_from && 
        assignment.available_to && 
        today >= assignment.available_from && 
        today <= assignment.available_to;
      
      if (isTemporarilyAvailable) {
        temporarilyAvailableBays.set(assignment.bay_id, assignment.user_id);
        console.log(`Bay ${assignment.bay_id} has temporary availability: ${assignment.available_from} to ${assignment.available_to}`);
      } 
      // Only add to permanentAssignmentsMap if the day matches current day
      else if (assignment.day_of_week === currentDayOfWeek || assignment.day_of_week === 'All Days') {
        // If the bay isn't already marked as temporarily available, add it to permanent assignments
        if (!temporarilyAvailableBays.has(assignment.bay_id)) {
          permanentAssignmentsMap.set(assignment.bay_id, assignment.user_id);
          console.log(`Bay ${assignment.bay_id} permanently assigned to ${assignment.user_id} for ${assignment.day_of_week}`);
        }
      }
    });
  }
  
  // Process bays with all the collected information
  const processedBays = baysData.map(bay => {
    if (!bay || !bay.bay_id) {
      console.error('Invalid bay object:', bay);
      return null;
    }

    try {
      const baseBay = castToBay(bay);
      
      if (baseBay.status === 'Maintenance') {
        return baseBay;
      }
      
      // Check active daily claims first (highest priority)
      if (activeDailyClaimsMap.has(bay.bay_id)) {
        const claimedByUserId = activeDailyClaimsMap.get(bay.bay_id);
        const claimedByUser = claimedByUserId === currentUserId;
        return {
          ...baseBay,
          status: 'Reserved' as Bay['status'],
          reserved_by_you: claimedByUser,
          reserved_by: claimedByUserId,
          is_permanent: false
        };
      }
      
      // Check if temporarily available
      if (temporarilyAvailableBays.has(bay.bay_id)) {
        console.log(`Bay ${bay.bay_number} is temporarily available for today`);
        return {
          ...baseBay,
          status: 'Available' as Bay['status']
        };
      }
      
      // Check permanent assignments
      if (permanentAssignmentsMap.has(bay.bay_id)) {
        const assignedToUserId = permanentAssignmentsMap.get(bay.bay_id);
        const assignedToUser = assignedToUserId === currentUserId;
        
        // Check if the permanent assignee has cancelled for today
        const hasCancelledClaim = cancelledDailyClaimsMap.has(bay.bay_id) && 
                            cancelledDailyClaimsMap.get(bay.bay_id).has(assignedToUserId);
        
        console.log(`Bay ${bay.bay_number}: Permanent assignment to ${assignedToUserId}, cancelled: ${hasCancelledClaim}`);
        
        if (hasCancelledClaim) {
          console.log(`Bay ${bay.bay_number} has been cancelled by its permanent assignee - marking as AVAILABLE`);
          return {
            ...baseBay,
            status: 'Available' as Bay['status']
          };
        }
        
        return {
          ...baseBay,
          status: 'Reserved' as Bay['status'],
          reserved_by_you: assignedToUser,
          reserved_by: assignedToUserId,
          is_permanent: true
        };
      }
      
      // If no claims or assignments, bay is available
      return {
        ...baseBay,
        status: 'Available' as Bay['status']
      };
    } catch (error) {
      console.error(`Error processing bay ${bay?.bay_number || 'unknown'}:`, error);
      return null;
    }
  }).filter(Boolean) as Bay[]; // Filter out any null values that might have resulted from invalid bay objects
  
  console.log(`Processed ${processedBays.length} bays successfully out of ${baysData.length} total bays`);
  return processedBays;
};

/**
 * Log bay status for debugging
 */
export const logBayStatus = (bays: Bay[]) => {
  if (!bays || !Array.isArray(bays)) {
    console.error('Invalid bays array for logging:', bays);
    return;
  }
  
  bays.forEach(bay => {
    if (bay && bay.bay_number) {
      console.log(`Final status - Bay ${bay.bay_number}: ${bay.status}${bay.reserved_by ? ' (Reserved by: ' + bay.reserved_by + ')' : ''}`);
    }
  });
};
