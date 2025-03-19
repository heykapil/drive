import { CompactEncrypt, JWTPayload, SignJWT, compactDecrypt, importJWK, jwtVerify } from "jose";

// Helper function to safely parse JSON from environment variables
function parseJWK(envVar?: string) {
  if (!envVar) throw new Error("❌ Missing JWK key in environment variables.");
  try {
    return JSON.parse(envVar); // Convert string to JSON object
  } catch (error: any) {
    console.error("❌ Invalid JSON in environment variable:", envVar);
    throw new Error("❌ Failed to parse JWK. Check your .env formatting.");
  }
}

// Load and parse the keys
const SIGNING_PRIVATE_KEY_JWK = parseJWK(process.env.SIGNING_PRIVATE_KEY);
const SIGNING_PUBLIC_KEY_JWK = parseJWK(process.env.SIGNING_PUBLIC_KEY);
const ENCRYPTION_PRIVATE_KEY_JWK = parseJWK(process.env.ENCRYPTION_PRIVATE_KEY);
const ENCRYPTION_PUBLIC_KEY_JWK = parseJWK(process.env.ENCRYPTION_PUBLIC_KEY);

// Convert JWKs to CryptoKey objects
async function loadSigningKeys() {
  return {
    privateKey: await importJWK(SIGNING_PRIVATE_KEY_JWK, "EdDSA"),
    publicKey: await importJWK(SIGNING_PUBLIC_KEY_JWK, "EdDSA"),
  };
}

async function loadEncryptionKeys() {
  return {
    privateKey: await importJWK(ENCRYPTION_PRIVATE_KEY_JWK, "ECDH-ES"),
    publicKey: await importJWK(ENCRYPTION_PUBLIC_KEY_JWK, "ECDH-ES"),
  };
}

const DEFAULT_EXPIRATION = "5m";


// 📝 **Sign JWT (JWS)**
export async function signJWT(
  payload: JWTPayload,
  expirationTime: string = DEFAULT_EXPIRATION
): Promise<string> {
  const { privateKey } = await loadSigningKeys();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(privateKey);
}

// 🔎 **Verify JWT (JWS)**
export async function verifyJWT(token: string): Promise<JWTPayload> {
  const { publicKey } = await loadSigningKeys();
  const { payload } = await jwtVerify(token, publicKey);
  return payload;
}

// 🔒 **Encrypt JWT (JWE)**
export async function encryptJWT(payload: JWTPayload): Promise<string> {
  const { publicKey } = await loadEncryptionKeys();
  const encoder = new TextEncoder();

  return await new CompactEncrypt(encoder.encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "ECDH-ES", enc: "A256GCM" })
    .encrypt(publicKey);
}

// 🔓 **Decrypt JWT (JWE)**
export async function decryptJWT(token: string): Promise<JWTPayload> {
  const { privateKey } = await loadEncryptionKeys();
  const { plaintext } = await compactDecrypt(token, privateKey);

  return JSON.parse(new TextDecoder().decode(plaintext));
}
