
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to fetch user names from user IDs
 */
export const useUserNames = () => {
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  
  const fetchUserNames = useCallback(async (userIds: Set<string>) => {
    if (userIds.size === 0) return {};
    
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('user_id, name')
        .in('user_id', Array.from(userIds));
        
      if (userError) throw userError;
      
      const namesMap: Record<string, string> = {};
      userData.forEach(u => {
        namesMap[u.user_id] = u.name;
      });
      
      setUserNames(namesMap);
      return namesMap;
    } catch (error) {
      console.error('Error fetching user names:', error);
      return {};
    }
  }, []);
  
  return { userNames, fetchUserNames };
};
