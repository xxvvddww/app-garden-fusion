
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

type SubscriptionConfig = {
  table: string;
  schema?: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
};

/**
 * Hook to manage Supabase real-time subscriptions with proper lifecycle handling
 */
export function useSupabaseSubscription(
  config: SubscriptionConfig | SubscriptionConfig[],
  callback: () => void,
  enabled: boolean = true
) {
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const callbackRef = useRef(callback);
  const isMountedRef = useRef(true);

  // Update the callback ref when the callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Clean up any existing channels
    const cleanupChannels = () => {
      if (channelsRef.current.length > 0) {
        console.log(`Cleaning up ${channelsRef.current.length} Supabase channels`);
        channelsRef.current.forEach(channel => {
          supabase.removeChannel(channel).catch(err => {
            console.error('Error removing Supabase channel:', err);
          });
        });
        channelsRef.current = [];
      }
    };
    
    // Only setup subscriptions if enabled
    if (!enabled) {
      cleanupChannels();
      return;
    }
    
    // Create new subscriptions
    const setupSubscriptions = () => {
      cleanupChannels();
      
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const configs = Array.isArray(config) ? config : [config];
      
      configs.forEach((cfg, index) => {
        const channelName = `${cfg.table}-subscription-${uniqueId}-${index}`;
        console.log(`Setting up Supabase subscription for ${cfg.table}`);
        
        try {
          const channel = supabase
            .channel(channelName)
            .on(
              'postgres_changes',
              {
                event: cfg.event || '*',
                schema: cfg.schema || 'public',
                table: cfg.table,
                filter: cfg.filter
              },
              () => {
                console.log(`Real-time update from ${cfg.table} table`);
                if (isMountedRef.current) {
                  callbackRef.current();
                }
              }
            )
            .subscribe(status => {
              console.log(`Subscription to ${cfg.table} status:`, status);
            });
          
          channelsRef.current.push(channel);
        } catch (error) {
          console.error(`Error setting up subscription for ${cfg.table}:`, error);
        }
      });
    };
    
    setupSubscriptions();
    
    return () => {
      console.log('useSupabaseSubscription cleanup');
      isMountedRef.current = false;
      cleanupChannels();
    };
  }, [config, enabled]);

  // Return a function to manually refresh subscriptions
  return {
    refresh: () => {
      if (!isMountedRef.current) return;
      callbackRef.current();
    }
  };
}
