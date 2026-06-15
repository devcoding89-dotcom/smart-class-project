/**
 * Browser Fingerprint Utility
 * Generates a deterministic device fingerprint from browser characteristics.
 * Used to enforce one-device-one-account policy.
 */

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Draw text with specific styling
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('SmartClass FP', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('SmartClass FP', 4, 17);

    return canvas.toDataURL();
  } catch {
    return '';
  }
}

function collectBrowserSignals(): string {
  const signals: string[] = [];

  // Screen properties
  signals.push(`${screen.width}x${screen.height}`);
  signals.push(`${screen.colorDepth}`);
  signals.push(`${screen.pixelDepth}`);

  // User agent
  signals.push(navigator.userAgent);

  // Platform
  signals.push(navigator.platform || '');

  // Language
  signals.push(navigator.language || '');

  // Timezone
  signals.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');

  // Hardware concurrency
  signals.push(`${navigator.hardwareConcurrency || 0}`);

  // Device memory (Chrome only)
  const nav = navigator as Navigator & { deviceMemory?: number };
  signals.push(`${nav.deviceMemory || 0}`);

  // Touch support
  signals.push(`${navigator.maxTouchPoints || 0}`);

  // Canvas fingerprint
  signals.push(getCanvasFingerprint());

  return signals.join('|||');
}

const FINGERPRINT_KEY = 'sc_device_fp';

/**
 * Generate a device fingerprint.
 * Returns a hex SHA-256 hash of browser signals.
 * The result is cached in localStorage for consistency.
 */
export async function getDeviceFingerprint(): Promise<string> {
  // Check cache first for consistency across sessions
  const cached = localStorage.getItem(FINGERPRINT_KEY);
  if (cached) return cached;

  const signals = collectBrowserSignals();
  const hash = await hashString(signals);

  // Cache the fingerprint
  localStorage.setItem(FINGERPRINT_KEY, hash);

  return hash;
}

/**
 * Clear the cached fingerprint (used on sign-out if needed)
 */
export function clearDeviceFingerprint(): void {
  localStorage.removeItem(FINGERPRINT_KEY);
}
