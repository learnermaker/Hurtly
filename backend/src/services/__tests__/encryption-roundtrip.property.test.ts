import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { EncryptionService } from "../encryption-service";

// Feature: body-trace, Property 20: Encryption round-trip
// **Validates: Requirements 9.1**

describe("Property 20: Encryption round-trip", () => {
  const service = new EncryptionService("test-master-key-for-property-tests");

  it("should decrypt to the original data for any byte sequence", { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        // Generate arbitrary byte arrays (0-10000 bytes)
        fc.uint8Array({ minLength: 0, maxLength: 10000 }),
        (byteArray) => {
          // Convert to Buffer
          const originalData = Buffer.from(byteArray);

          // Encrypt then decrypt
          const encrypted = service.encrypt(originalData);
          const decrypted = service.decrypt(encrypted);

          // Verify round-trip: decrypted should equal original
          expect(decrypted).toEqual(originalData);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should decrypt to the original string for any text", { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        // Generate arbitrary strings including unicode
        fc.string({ minLength: 0, maxLength: 5000 }),
        (text) => {
          // Encrypt then decrypt
          const encrypted = service.encryptString(text);
          const decrypted = service.decryptString(encrypted);

          // Verify round-trip
          expect(decrypted).toBe(text);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should decrypt to the original JSON for any object", { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        // Generate arbitrary JSON-serializable objects
        fc.record({
          id: fc.uuid(),
          name: fc.string(),
          value: fc.integer(),
          flag: fc.boolean(),
          nested: fc.record({
            data: fc.array(fc.string()),
            count: fc.nat(),
          }),
        }),
        (obj) => {
          // Encrypt then decrypt
          const encrypted = service.encryptJSON(obj);
          const decrypted = service.decryptJSON(encrypted);

          // Verify round-trip
          expect(decrypted).toEqual(obj);
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should produce different ciphertexts for the same plaintext (probabilistic encryption)", { timeout: 60000 }, () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 1000 }),
        (byteArray) => {
          const data = Buffer.from(byteArray);

          // Encrypt the same data twice
          const encrypted1 = service.encrypt(data);
          const encrypted2 = service.encrypt(data);

          // Different IVs and salts should produce different ciphertexts
          // (This is important for security - same plaintext shouldn't produce same ciphertext)
          // The IV and salt are randomly generated, so they should always be different
          expect(encrypted1.iv).not.toBe(encrypted2.iv);
          expect(encrypted1.salt).not.toBe(encrypted2.salt);
          
          // With different IV and salt, the encrypted data should also be different
          // Note: We check this as a logical consequence, not as the primary assertion
          // because the security property is about IV/salt randomness
          expect(encrypted1.data).not.toBe(encrypted2.data);

          // But both should decrypt to the same original data
          const decrypted1 = service.decrypt(encrypted1);
          const decrypted2 = service.decrypt(encrypted2);
          expect(decrypted1).toEqual(data);
          expect(decrypted2).toEqual(data);
        }
      ),
      { numRuns: 50 } // Reduced from 100 due to double encryption
    );
  });

  it("should fail decryption if any component is tampered with", { timeout: 30000 }, () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 10, maxLength: 1000 }),
        fc.nat({ max: 3 }), // Which component to tamper: 0=data, 1=iv, 2=salt, 3=authTag
        (byteArray, tamperTarget) => {
          const data = Buffer.from(byteArray);
          const encrypted = service.encrypt(data);

          // Tamper with one component
          const tampered = { ...encrypted };
          switch (tamperTarget) {
            case 0: {
              // Tamper with encrypted data
              const dataBuffer = Buffer.from(tampered.data, "base64");
              if (dataBuffer.length > 0) {
                dataBuffer[0] = dataBuffer[0] ^ 0xFF;
                tampered.data = dataBuffer.toString("base64");
              }
              break;
            }
            case 1: {
              // Tamper with IV
              const ivBuffer = Buffer.from(tampered.iv, "base64");
              ivBuffer[0] = ivBuffer[0] ^ 0xFF;
              tampered.iv = ivBuffer.toString("base64");
              break;
            }
            case 2: {
              // Tamper with salt (this changes the derived key)
              const saltBuffer = Buffer.from(tampered.salt, "base64");
              saltBuffer[0] = saltBuffer[0] ^ 0xFF;
              tampered.salt = saltBuffer.toString("base64");
              break;
            }
            case 3: {
              // Tamper with auth tag
              const tagBuffer = Buffer.from(tampered.authTag, "base64");
              tagBuffer[0] = tagBuffer[0] ^ 0xFF;
              tampered.authTag = tagBuffer.toString("base64");
              break;
            }
          }

          // Decryption should fail for tampered data
          expect(() => service.decrypt(tampered)).toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });

  it("should maintain data integrity across multiple encrypt/decrypt cycles", { timeout: 60000 }, () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1000 }),
        fc.integer({ min: 1, max: 5 }), // Number of cycles
        (text, cycles) => {
          let current = text;

          // Perform multiple encrypt/decrypt cycles
          for (let i = 0; i < cycles; i++) {
            const encrypted = service.encryptString(current);
            current = service.decryptString(encrypted);
          }

          // After all cycles, should still have original data
          expect(current).toBe(text);
        }
      ),
      { numRuns: 20 }
    );
  });
});
