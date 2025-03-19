import crypto from 'crypto';

// Use a secure secret for HMAC (ideally from environment variables)
const TOKEN_SECRET = process.env.TOKEN_SECRET!

// Base62 alphabet (0-9, a-z, A-Z) for URL safe encoding
const BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Encodes a bigint to a base62 string.
 */
 function encodeBase62(num: bigint): string {
   // Special case for zero
   if (num === BigInt(0)) return "0";

   let encoded = '';
   const base = BigInt(62);

   // Convert the number to base 62 by repeatedly dividing and taking the remainder
   while (num > BigInt(0)) {
     const rem = num % base;
     encoded = BASE62_ALPHABET[Number(rem)] + encoded;
     num = num / base;
   }
   return encoded;
 }

/**
 * Decodes a base62 string back into a bigint.
 */
function decodeBase62(str: string): bigint {
  let num = BigInt(0);
  const base = BigInt(62);
  for (const char of str) {
    const index = BigInt(BASE62_ALPHABET.indexOf(char));
    if (index < BigInt(0)) throw new Error('Invalid character in base62 string');
    num = num * base + index;
  }
  return num;
}

/**
 * Generates a secure, short token with an embedded expiry timestamp.
 *
 * The token is composed of three parts:
 * - encoded expiry timestamp (in seconds)
 * - encoded random value (48 bits for randomness)
 * - encoded HMAC signature (first 8 bytes of HMAC-SHA256 over the previous parts)
 *
 * @param expirationDays - Number of days until the token expires (default is 7 days)
 * @returns A URL-safe token string.
 */
export function generateToken(expirationDays: number = 7): string {
  // Current time in seconds.
  const now = Math.floor(Date.now() / 1000);
  // Compute expiration timestamp (in seconds).
  const expiry = now + expirationDays * 86400;
  const encodedExpiry = encodeBase62(BigInt(expiry));

  // Generate 6 random bytes (48 bits) for randomness.
  const randomBytes = crypto.randomBytes(6);
  const randomValue = BigInt('0x' + randomBytes.toString('hex'));
  const encodedRandom = encodeBase62(randomValue);

  // Prepare the string to be signed.
  const dataToSign = `${encodedExpiry}.${encodedRandom}`;

  // Create an HMAC using SHA256 and truncate to the first 8 bytes (64 bits).
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET);
  hmac.update(dataToSign);
  const fullSignature = hmac.digest();
  const signatureBytes = fullSignature.slice(0, 8);
  const signatureValue = BigInt('0x' + signatureBytes.toString('hex'));
  const encodedSignature = encodeBase62(signatureValue);

  // Final token structure: <expiry>.<random>.<signature>
  const token = `${encodedExpiry}.${encodedRandom}.${encodedSignature}`;
  return token;
}

/**
 * Verifies a token’s authenticity and checks its expiration.
 *
 * It splits the token into its parts, recalculates the signature, and decodes the
 * embedded expiry timestamp to check if the token is still valid.
 *
 * @param token - The token string to verify.
 * @returns An object indicating if the token is valid, if it’s expired, and its expiry timestamp.
 */
export function verifyToken(token: string): { valid: boolean, expired: boolean, expiry?: number } {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, expired: false };
  }
  const [encodedExpiry, encodedRandom, encodedSignature] = parts;

  // Recreate the signed data.
  const dataToSign = `${encodedExpiry}.${encodedRandom}`;
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET);
  hmac.update(dataToSign);
  const fullSignature = hmac.digest();
  const expectedSignatureBytes = fullSignature.slice(0, 8);
  const expectedSignatureValue = BigInt('0x' + expectedSignatureBytes.toString('hex'));
  const expectedEncodedSignature = encodeBase62(expectedSignatureValue);

  // If the signatures don't match, the token is invalid.
  if (expectedEncodedSignature !== encodedSignature) {
    return { valid: false, expired: false };
  }

  // Decode the expiry timestamp.
  let expiryTimestamp: number;
  try {
    expiryTimestamp = Number(decodeBase62(encodedExpiry));
  } catch (err: any) {
    return { valid: false, expired: false };
  }

  // Check if the token is expired.
  const now = Math.floor(Date.now() / 1000);
  const expired = now > expiryTimestamp;
  return { valid: true, expired, expiry: expiryTimestamp };
}
