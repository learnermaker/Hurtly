import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Encrypted payload structure containing the encrypted data and metadata
 */
export interface EncryptedPayload {
  /** The encrypted data as a base64-encoded string */
  data: string;
  /** Initialization vector used for encryption (base64-encoded) */
  iv: string;
  /** Salt used for key derivation (base64-encoded) */
  salt: string;
  /** Authentication tag for AES-GCM (base64-encoded) */
  authTag: string;
}

/**
 * Encryption Service
 * 
 * Provides AES-256-GCM encryption and decryption for sensitive health data at rest.
 * Uses scrypt for key derivation from a master key.
 * 
 * Requirements: 9.1 - Encrypt all Symptom_Signals and Body_Map data at rest using AES-256
 */
export class EncryptionService {
  private readonly algorithm = "aes-256-gcm";
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits for GCM
  private readonly saltLength = 32;
  private readonly masterKey: string;

  /**
   * Create a new EncryptionService instance
   * @param masterKey - The master encryption key (should be stored securely, e.g., in environment variables)
   */
  constructor(masterKey?: string) {
    // In production, this should come from a secure environment variable
    this.masterKey = masterKey || process.env.ENCRYPTION_MASTER_KEY || "default-insecure-key-change-in-production";
    
    if (this.masterKey === "default-insecure-key-change-in-production") {
      console.warn("WARNING: Using default encryption key. Set ENCRYPTION_MASTER_KEY environment variable in production.");
    }
  }

  /**
   * Derive an encryption key from the master key using scrypt
   * @param salt - Salt for key derivation
   * @returns Derived key buffer
   */
  private deriveKey(salt: Buffer): Buffer {
    return scryptSync(this.masterKey, salt, this.keyLength);
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param data - Data to encrypt (Buffer)
   * @returns EncryptedPayload containing encrypted data and metadata
   */
  encrypt(data: Buffer): EncryptedPayload {
    // Generate random salt and IV
    const salt = randomBytes(this.saltLength);
    const iv = randomBytes(this.ivLength);

    // Derive encryption key from master key and salt
    const key = this.deriveKey(salt);

    // Create cipher and encrypt
    const cipher = createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

    // Get authentication tag (GCM mode)
    const authTag = cipher.getAuthTag();

    return {
      data: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      salt: salt.toString("base64"),
      authTag: authTag.toString("base64"),
    };
  }

  /**
   * Decrypt an encrypted payload using AES-256-GCM
   * @param payload - EncryptedPayload to decrypt
   * @returns Decrypted data as Buffer
   * @throws Error if decryption fails (e.g., tampered data, wrong key)
   */
  decrypt(payload: EncryptedPayload): Buffer {
    // Convert base64 strings back to buffers
    const encryptedData = Buffer.from(payload.data, "base64");
    const iv = Buffer.from(payload.iv, "base64");
    const salt = Buffer.from(payload.salt, "base64");
    const authTag = Buffer.from(payload.authTag, "base64");

    // Derive the same key using the stored salt
    const key = this.deriveKey(salt);

    // Create decipher and set auth tag
    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    return decrypted;
  }

  /**
   * Encrypt a string
   * @param text - String to encrypt
   * @returns EncryptedPayload
   */
  encryptString(text: string): EncryptedPayload {
    return this.encrypt(Buffer.from(text, "utf-8"));
  }

  /**
   * Decrypt to a string
   * @param payload - EncryptedPayload to decrypt
   * @returns Decrypted string
   */
  decryptString(payload: EncryptedPayload): string {
    return this.decrypt(payload).toString("utf-8");
  }

  /**
   * Encrypt a JSON object
   * @param obj - Object to encrypt
   * @returns EncryptedPayload
   */
  encryptJSON<T>(obj: T): EncryptedPayload {
    const json = JSON.stringify(obj);
    return this.encryptString(json);
  }

  /**
   * Decrypt to a JSON object
   * @param payload - EncryptedPayload to decrypt
   * @returns Decrypted and parsed object
   */
  decryptJSON<T>(payload: EncryptedPayload): T {
    const json = this.decryptString(payload);
    return JSON.parse(json) as T;
  }
}

// Export a singleton instance for convenience
export const encryptionService = new EncryptionService();
