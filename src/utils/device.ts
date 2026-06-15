import { supabase } from '../config/supabase';

/**
 * Gets the current device fingerprint from localStorage, or generates a new one.
 */
export function getOrCreateDeviceFingerprint(): string {
  let fingerprint = localStorage.getItem('device_fingerprint');
  if (!fingerprint) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let rand = '';
    for (let i = 0; i < 28; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    fingerprint = 'dev_' + rand;
    localStorage.setItem('device_fingerprint', fingerprint);
  }
  return fingerprint;
}

export interface DeviceAssociationResult {
  associated: boolean;
  is_self?: boolean;
  linked_email?: string;
}

/**
 * Checks if the current device is already locked to an account.
 * If userId is provided, it verifies if the locked account is the same user.
 */
export async function checkDeviceLocked(userId?: string): Promise<DeviceAssociationResult> {
  const fingerprint = getOrCreateDeviceFingerprint();
  const { data, error } = await supabase.rpc('check_device_association', {
    fingerprint_val: fingerprint,
    user_id_val: userId || null
  });
  
  if (error) {
    console.error('Error checking device lock status:', error);
    return { associated: false };
  }
  
  return data as DeviceAssociationResult;
}
