import { useEffect } from 'react';
import { supabase } from '../config/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeTable(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  callback: (payload: any) => void,
  filter?: string
) {
  useEffect(() => {
    const channelName = `${table}_${event}_${filter || 'all'}_${Date.now()}`;
    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event, schema: 'public', table, ...(filter ? { filter } : {}) } as any,
        (payload: any) => callback(payload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, filter, callback]);
}
