/**
 * PII / secret scrubbing for bug-report payloads.
 *
 * Two layers of protection:
 *  1. Keys whose name looks sensitive (password, token, card, ...) are dropped
 *     entirely — their values never touch the database.
 *  2. Values that *look* like an email or phone number are masked in place.
 *
 * This runs on every free-form payload the client sends (logs, metadata,
 * deviceInfo, appInfo) as well as the title/description text fields.
 */

/** Keys we refuse to persist, matched case-insensitively as a substring. */
const FORBIDDEN_KEY_PARTS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'authorization',
  'auth',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'refresh',
  'session',
  'cookie',
  'creditcard',
  'credit_card',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'pan',
  'iban',
  'ssn',
  'pin',
  'otp',
  'privatekey',
  'private_key',
];

const REDACTED = '[redacted]';

// Email: local@domain.tld
const EMAIL_RE =
  /([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
// Phone: 7+ digits possibly grouped with spaces/dashes/parens, optional leading +
const PHONE_RE = /(\+?\d[\d\s().-]{6,}\d)/g;
// Bearer tokens / long opaque secrets embedded in free text
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._-]+/gi;
const LONG_SECRET_RE = /\b[A-Za-z0-9_-]{40,}\b/g;

function isForbiddenKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return FORBIDDEN_KEY_PARTS.some((part) =>
    k.includes(part.replace(/[^a-z0-9]/g, '')),
  );
}

function maskPhone(match: string): string {
  const digits = match.replace(/\D/g, '');
  if (digits.length < 7) return match; // too short to be a phone number
  const last2 = digits.slice(-2);
  return `***${last2}`;
}

/** Mask PII inside a single string value. */
export function maskString(input: string): string {
  if (!input) return input;
  return input
    .replace(BEARER_RE, 'Bearer [redacted]')
    .replace(
      EMAIL_RE,
      (_m, first: string, domain: string) => `${first}***${domain}`,
    )
    .replace(PHONE_RE, maskPhone)
    .replace(LONG_SECRET_RE, REDACTED);
}

/**
 * Recursively scrub any JSON-serialisable value. Returns a new structure;
 * the input is never mutated. Depth/size bounded to avoid pathological input.
 */
export function scrubPii(value: unknown, depth = 0): unknown {
  if (depth > 12) return REDACTED;
  if (value == null) return value;

  if (typeof value === 'string') return maskString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value.slice(0, 1000).map((item) => scrubPii(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isForbiddenKey(key)) {
        out[key] = REDACTED;
        continue;
      }
      out[key] = scrubPii(val, depth + 1);
    }
    return out;
  }

  // functions, symbols, bigint, etc. — never persist
  return REDACTED;
}
