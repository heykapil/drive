import * as fs from "fs";
import { exportJWK, generateKeyPair } from "jose";
import * as path from "path";

// Function to generate signing (Ed25519) and encryption (X25519) key pairs
async function generateKeys() {
  console.log("Generating Signing and Encryption Keys...");

  // Generate Ed25519 key pair for signing
  const signingKeyPair = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  const signingPrivateJWK = await exportJWK(signingKeyPair.privateKey);
  const signingPublicJWK = await exportJWK(signingKeyPair.publicKey);

  // Generate X25519 key pair for encryption
  const encryptionKeyPair = await generateKeyPair("ECDH-ES", { crv: "X25519", extractable:true });
  const encryptionPrivateJWK = await exportJWK(encryptionKeyPair.privateKey);
  const encryptionPublicJWK = await exportJWK(encryptionKeyPair.publicKey);

  // Keys in JSON format
  const keys = {
    signing: {
      privateKey: signingPrivateJWK,
      publicKey: signingPublicJWK,
    },
    encryption: {
      privateKey: encryptionPrivateJWK,
      publicKey: encryptionPublicJWK,
    },
  };

  // Print keys to console
  console.log("🔑 Generated Keys (JWK Format):");
  console.log(JSON.stringify(keys, null, 2));

  // Convert keys to .env format
  const envContent = `
SIGNING_PRIVATE_KEY='${JSON.stringify(signingPrivateJWK)}'
SIGNING_PUBLIC_KEY='${JSON.stringify(signingPublicJWK)}'
ENCRYPTION_PRIVATE_KEY='${JSON.stringify(encryptionPrivateJWK)}'
ENCRYPTION_PUBLIC_KEY='${JSON.stringify(encryptionPublicJWK)}'
  `.trim();

  // Save keys to .env file
  const envPath = path.join(__dirname, ".env");
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ Keys saved to ${envPath}`);
}

// Run the key generation function
generateKeys().catch(console.error);
