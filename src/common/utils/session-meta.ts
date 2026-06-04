export type SessionMeta = {
  userAgent?: string;
  ipAddress?: string;
};

export function parseUserAgent(ua?: string) {
  if (!ua) {
    return { deviceName: 'Unknown device', browser: 'Browser', os: 'Unknown OS' };
  }
  const lower = ua.toLowerCase();
  let os = 'Unknown OS';
  if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('mac os') || lower.includes('macintosh')) os = 'macOS';
  else if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('linux')) os = 'Linux';

  let browser = 'Browser';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/') && !lower.includes('edg/')) browser = 'Chrome';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  else if (lower.includes('safari/') && !lower.includes('chrome/')) browser = 'Safari';

  const deviceName =
    lower.includes('mobile') || lower.includes('iphone') || lower.includes('android')
      ? 'Mobile'
      : 'Desktop';

  return { deviceName, browser, os };
}

export function requestSessionMeta(req?: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}): SessionMeta {
  const raw = req?.headers?.['user-agent'];
  const userAgent = Array.isArray(raw) ? raw[0] : raw;
  const forwarded = req?.headers?.['x-forwarded-for'];
  const ipRaw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ipAddress = ipRaw?.split(',')[0]?.trim() || req?.ip;
  return { userAgent, ipAddress };
}
