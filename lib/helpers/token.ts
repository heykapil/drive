import crypto from 'crypto';

// Configuration
const TOKEN_SECRET = process.env.TOKEN_SECRET!; // From environment variables
const CUSTOM_EPOCH = 1577836800; // 2020-01-01T00:00:00Z in seconds
const BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Type definitions
interface VerificationResult {
  valid: boolean;
  expired: boolean;
  fileId?: number;
  createdAt?: number;
  expiresAt?: number;
}

/**
 * Encodes a bigint to a base62 string
 */
function encodeBase62(num: bigint): string {
  if (num < BigInt(0)) throw new Error("Negative numbers not supported");
  if (num === BigInt(0)) return BASE62_ALPHABET[0];

  let encoded = '';
  const base = BigInt(62);

  while (num > BigInt(0)) {
    const rem = num % base;
    encoded = BASE62_ALPHABET[Number(rem)] + encoded;
    num = num / base;
  }
  return encoded;
}

/**
 * Decodes a base62 string to a bigint
 */
function decodeBase62(str: string): bigint {
  let num = BigInt(0);
  const base = BigInt(62);

  for (const char of str) {
    const index = BigInt(BASE62_ALPHABET.indexOf(char));
    if (index < BigInt(0)) throw new Error('Invalid base62 character');
    num = num * base + index;
  }
  return num;
}

/**
 * Generates a secure token containing file ID and expiration information
 * Token format: <combinedCE>.<fileId>.<random>.<signature>
 */
export function generateToken(fileId: number, expirationDays: number = 7): string {
  if (!Number.isInteger(fileId)) {
    throw new Error("File ID must be an integer")
  };
  if (expirationDays < 0 || expirationDays > 65535) {
    throw new Error("Expiration days must be between 0 and 65535");
  }

  // Calculate creation time (seconds since custom epoch)
  const now = new Date();
  const nowUnix = Math.floor(now.getTime() / 1000);
  const creationTime = nowUnix - CUSTOM_EPOCH;
  if (creationTime < 0 || creationTime > 0xFFFFFFFF) {
    throw new Error("Creation time out of valid range");
  }

  // Combine creation time (32 bits) and expiration days (16 bits)
  const combinedCE = (BigInt(creationTime) << BigInt(16)) | BigInt(expirationDays);

  // Generate random component (48 bits)
  const randomBytes = crypto.randomBytes(6);
  const randomValue = BigInt('0x' + randomBytes.toString('hex'));

  // Prepare token components
  const encodedCombinedCE = encodeBase62(combinedCE);
  const encodedFileId = encodeBase62(BigInt(fileId));
  const encodedRandom = encodeBase62(randomValue);

  // Generate HMAC signature
  const dataToSign = `${encodedCombinedCE}.${encodedFileId}.${encodedRandom}`;
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET);
  hmac.update(dataToSign);
  const signature = encodeBase62(BigInt('0x' + hmac.digest().slice(0, 8).toString('hex')));

  return `${encodedCombinedCE}.${encodedFileId}.${encodedRandom}.${signature}`;
}

/**
 * Verifies token validity and extracts information
 */
export function verifyToken(token: string): VerificationResult {
  const parts = token.split('.');
  if (parts.length !== 4) return { valid: false, expired: false };

  try {
    // Decode token components
    const [encodedCombinedCE, encodedFileId, encodedRandom, encodedSignature] = parts;
    const combinedCE = decodeBase62(encodedCombinedCE);
    const signature = decodeBase62(encodedSignature);

    // Verify HMAC signature
    const dataToSign = `${encodedCombinedCE}.${encodedFileId}.${encodedRandom}`;
    const hmac = crypto.createHmac('sha256', TOKEN_SECRET);
    hmac.update(dataToSign);
    const expectedSignature = BigInt('0x' + hmac.digest().slice(0, 8).toString('hex'));

    if (signature !== expectedSignature) {
      return { valid: false, expired: false };
    }

    // Extract time components
    const creationTime = Number(combinedCE >> BigInt(16));
    const expirationDays = Number(combinedCE & BigInt(0xffff));
    const fileId = Number(decodeBase62(encodedFileId));

    // Validate numerical values
    if (
      !Number.isSafeInteger(creationTime) ||
      !Number.isSafeInteger(expirationDays) ||
      !Number.isSafeInteger(fileId) ||
      fileId < 0
    ) {
      return { valid: false, expired: false };
    }

    // Calculate expiration time
    const createdAt = creationTime + CUSTOM_EPOCH;
    const expiresAt = createdAt + expirationDays * 86400;
    const now = Math.floor(Date.now() / 1000);

    return {
      valid: true,
      expired: now > expiresAt,
      fileId,
      createdAt,
      expiresAt
    };
  } catch {
    return { valid: false, expired: false };
  }
}
