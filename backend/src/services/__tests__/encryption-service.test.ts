import { describe, it, expect } from "vitest";
import { EncryptionService } from "../encryption-service";

describe("EncryptionService", () => {
  const service = new EncryptionService("test-master-key-for-unit-tests");

  describe("encrypt and decrypt", () => {
    it("should encrypt and decrypt a buffer correctly", () => {
      const originalData = Buffer.from("sensitive health data", "utf-8");
      
      const encrypted = service.encrypt(originalData);
      
      // Verify encrypted payload structure
      expect(encrypted).toHaveProperty("data");
      expect(encrypted).toHaveProperty("iv");
      expect(encrypted).toHaveProperty("salt");
      expect(encrypted).toHaveProperty("authTag");
      
      // Verify encrypted data is different from original
      expect(encrypted.data).not.toBe(originalData.toString("base64"));
      
      // Decrypt and verify
      const decrypted = service.decrypt(encrypted);
      expect(decrypted.toString("utf-8")).toBe("sensitive health data");
    });

    it("should produce different encrypted outputs for the same input (due to random IV and salt)", () => {
      const data = Buffer.from("test data", "utf-8");
      
      const encrypted1 = service.encrypt(data);
      const encrypted2 = service.encrypt(data);
      
      // Different IVs and salts should produce different ciphertexts
      expect(encrypted1.data).not.toBe(encrypted2.data);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
      
      // But both should decrypt to the same original data
      expect(service.decrypt(encrypted1).toString("utf-8")).toBe("test data");
      expect(service.decrypt(encrypted2).toString("utf-8")).toBe("test data");
    });

    it("should handle empty buffers", () => {
      const emptyData = Buffer.from("", "utf-8");
      
      const encrypted = service.encrypt(emptyData);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted.toString("utf-8")).toBe("");
    });

    it("should handle large data", () => {
      const largeData = Buffer.from("x".repeat(10000), "utf-8");
      
      const encrypted = service.encrypt(largeData);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted.toString("utf-8")).toBe("x".repeat(10000));
    });
  });

  describe("encryptString and decryptString", () => {
    it("should encrypt and decrypt strings correctly", () => {
      const originalText = "Patient symptom data: sharp pain in left shoulder";
      
      const encrypted = service.encryptString(originalText);
      const decrypted = service.decryptString(encrypted);
      
      expect(decrypted).toBe(originalText);
    });

    it("should handle special characters and unicode", () => {
      const text = "Pain: 痛み, Douleur, Schmerz 🩺";
      
      const encrypted = service.encryptString(text);
      const decrypted = service.decryptString(encrypted);
      
      expect(decrypted).toBe(text);
    });
  });

  describe("encryptJSON and decryptJSON", () => {
    it("should encrypt and decrypt JSON objects correctly", () => {
      const symptomSignal = {
        id: "signal-123",
        markerId: "marker-456",
        anatomicalRegion: "left-shoulder",
        painType: "sharp",
        intensity: 7,
        frequency: "intermittent",
        duration: "hours",
        timestamp: "2024-01-15T10:30:00Z", // Use string instead of Date for JSON serialization
      };
      
      const encrypted = service.encryptJSON(symptomSignal);
      const decrypted = service.decryptJSON(encrypted);
      
      expect(decrypted).toEqual(symptomSignal);
    });

    it("should handle nested objects and arrays", () => {
      const bodyMap = {
        userId: "user-789",
        sessions: [
          { id: "session-1", markers: ["marker-1", "marker-2"] },
          { id: "session-2", markers: ["marker-3"] },
        ],
        metadata: {
          lastUpdated: "2024-01-15",
          version: 1,
        },
      };
      
      const encrypted = service.encryptJSON(bodyMap);
      const decrypted = service.decryptJSON(encrypted);
      
      expect(decrypted).toEqual(bodyMap);
    });
  });

  describe("authentication and tampering detection", () => {
    it("should throw an error if encrypted data is tampered with", () => {
      const data = Buffer.from("important data", "utf-8");
      const encrypted = service.encrypt(data);
      
      // Tamper with the encrypted data
      const tamperedData = Buffer.from(encrypted.data, "base64");
      tamperedData[0] = tamperedData[0] ^ 0xFF; // Flip bits
      encrypted.data = tamperedData.toString("base64");
      
      // Decryption should fail
      expect(() => service.decrypt(encrypted)).toThrow();
    });

    it("should throw an error if auth tag is tampered with", () => {
      const data = Buffer.from("important data", "utf-8");
      const encrypted = service.encrypt(data);
      
      // Tamper with the auth tag
      const tamperedTag = Buffer.from(encrypted.authTag, "base64");
      tamperedTag[0] = tamperedTag[0] ^ 0xFF;
      encrypted.authTag = tamperedTag.toString("base64");
      
      // Decryption should fail
      expect(() => service.decrypt(encrypted)).toThrow();
    });

    it("should throw an error if IV is tampered with", () => {
      const data = Buffer.from("important data", "utf-8");
      const encrypted = service.encrypt(data);
      
      // Tamper with the IV
      const tamperedIV = Buffer.from(encrypted.iv, "base64");
      tamperedIV[0] = tamperedIV[0] ^ 0xFF;
      encrypted.iv = tamperedIV.toString("base64");
      
      // Decryption should fail (will produce wrong output or throw)
      expect(() => service.decrypt(encrypted)).toThrow();
    });
  });

  describe("different encryption keys", () => {
    it("should not decrypt data encrypted with a different key", () => {
      const service1 = new EncryptionService("key-one");
      const service2 = new EncryptionService("key-two");
      
      const data = Buffer.from("secret data", "utf-8");
      const encrypted = service1.encrypt(data);
      
      // Attempting to decrypt with wrong key should fail
      expect(() => service2.decrypt(encrypted)).toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle binary data", () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD]);
      
      const encrypted = service.encrypt(binaryData);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toEqual(binaryData);
    });

    it("should handle data with null bytes", () => {
      const dataWithNulls = Buffer.from("data\x00with\x00nulls", "utf-8");
      
      const encrypted = service.encrypt(dataWithNulls);
      const decrypted = service.decrypt(encrypted);
      
      expect(decrypted).toEqual(dataWithNulls);
    });
  });
});
