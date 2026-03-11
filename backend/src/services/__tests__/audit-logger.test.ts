import { describe, it, expect, beforeEach } from "vitest";
import { AuditLogger, AuditEvent } from "../audit-logger";

describe("AuditLogger", () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  describe("logAccess", () => {
    it("should log a valid audit event", () => {
      const event: AuditEvent = {
        userId: "user-123",
        action: "read",
        resourceType: "pain_session",
        resourceId: "session-456",
        timestamp: new Date("2024-01-15T10:00:00Z"),
      };

      logger.logAccess(event);

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(event);
    });

    it("should log multiple events", () => {
      const event1: AuditEvent = {
        userId: "user-123",
        action: "read",
        resourceType: "pain_session",
        resourceId: "session-456",
        timestamp: new Date("2024-01-15T10:00:00Z"),
      };

      const event2: AuditEvent = {
        userId: "user-123",
        action: "update",
        resourceType: "body_map",
        resourceId: "map-789",
        timestamp: new Date("2024-01-15T10:05:00Z"),
      };

      logger.logAccess(event1);
      logger.logAccess(event2);

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0]).toEqual(event1);
      expect(logs[1]).toEqual(event2);
    });

    it("should reject events containing painType", () => {
      const event: any = {
        userId: "user-123",
        action: "read",
        resourceType: "pain_marker",
        resourceId: "marker-456",
        timestamp: new Date(),
        painType: "sharp", // Forbidden field
      };

      expect(() => logger.logAccess(event)).toThrow(
        "Audit log must not contain symptom content"
      );
    });

    it("should reject events containing intensity", () => {
      const event: any = {
        userId: "user-123",
        action: "read",
        resourceType: "pain_marker",
        resourceId: "marker-456",
        timestamp: new Date(),
        intensity: 7, // Forbidden field
      };

      expect(() => logger.logAccess(event)).toThrow(
        "Audit log must not contain symptom content"
      );
    });

    it("should reject events containing frequency", () => {
      const event: any = {
        userId: "user-123",
        action: "read",
        resourceType: "pain_marker",
        resourceId: "marker-456",
        timestamp: new Date(),
        frequency: "constant", // Forbidden field
      };

      expect(() => logger.logAccess(event)).toThrow(
        "Audit log must not contain symptom content"
      );
    });

    it("should reject events containing duration", () => {
      const event: any = {
        userId: "user-123",
        action: "read",
        resourceType: "pain_marker",
        resourceId: "marker-456",
        timestamp: new Date(),
        duration: "hours", // Forbidden field
      };

      expect(() => logger.logAccess(event)).toThrow(
        "Audit log must not contain symptom content"
      );
    });

    it("should reject events containing followUpText", () => {
      const event: any = {
        userId: "user-123",
        action: "read",
        resourceType: "symptom_descriptor",
        resourceId: "desc-456",
        timestamp: new Date(),
        followUpText: "Does it hurt when you move?", // Forbidden field
      };

      expect(() => logger.logAccess(event)).toThrow(
        "Audit log must not contain symptom content"
      );
    });

    it("should reject events containing response", () => {
      const event: any = {
        userId: "user-123",
        action: "read",
        resourceType: "symptom_descriptor",
        resourceId: "desc-456",
        timestamp: new Date(),
        response: "Yes, it hurts when I move", // Forbidden field
      };

      expect(() => logger.logAccess(event)).toThrow(
        "Audit log must not contain symptom content"
      );
    });

    it("should not add forbidden fields to the log even if present in input", () => {
      const event: any = {
        userId: "user-123",
        action: "read",
        resourceType: "pain_marker",
        resourceId: "marker-456",
        timestamp: new Date("2024-01-15T10:00:00Z"),
      };

      logger.logAccess(event);

      const logs = logger.getAllLogs();
      expect(logs[0]).not.toHaveProperty("painType");
      expect(logs[0]).not.toHaveProperty("intensity");
      expect(logs[0]).not.toHaveProperty("frequency");
      expect(logs[0]).not.toHaveProperty("duration");
    });
  });

  describe("getLogsByUser", () => {
    it("should return logs for a specific user", () => {
      const event1: AuditEvent = {
        userId: "user-123",
        action: "read",
        resourceType: "pain_session",
        resourceId: "session-456",
        timestamp: new Date(),
      };

      const event2: AuditEvent = {
        userId: "user-456",
        action: "read",
        resourceType: "body_map",
        resourceId: "map-789",
        timestamp: new Date(),
      };

      const event3: AuditEvent = {
        userId: "user-123",
        action: "update",
        resourceType: "pain_marker",
        resourceId: "marker-111",
        timestamp: new Date(),
      };

      logger.logAccess(event1);
      logger.logAccess(event2);
      logger.logAccess(event3);

      const user123Logs = logger.getLogsByUser("user-123");
      expect(user123Logs).toHaveLength(2);
      expect(user123Logs[0]).toEqual(event1);
      expect(user123Logs[1]).toEqual(event3);
    });

    it("should return empty array for user with no logs", () => {
      const logs = logger.getLogsByUser("user-nonexistent");
      expect(logs).toEqual([]);
    });
  });

  describe("getLogsByResource", () => {
    it("should return logs for a specific resource", () => {
      const event1: AuditEvent = {
        userId: "user-123",
        action: "read",
        resourceType: "pain_session",
        resourceId: "session-456",
        timestamp: new Date(),
      };

      const event2: AuditEvent = {
        userId: "user-456",
        action: "update",
        resourceType: "pain_session",
        resourceId: "session-456",
        timestamp: new Date(),
      };

      const event3: AuditEvent = {
        userId: "user-123",
        action: "read",
        resourceType: "body_map",
        resourceId: "map-789",
        timestamp: new Date(),
      };

      logger.logAccess(event1);
      logger.logAccess(event2);
      logger.logAccess(event3);

      const sessionLogs = logger.getLogsByResource("pain_session", "session-456");
      expect(sessionLogs).toHaveLength(2);
      expect(sessionLogs[0]).toEqual(event1);
      expect(sessionLogs[1]).toEqual(event2);
    });

    it("should return empty array for resource with no logs", () => {
      const logs = logger.getLogsByResource("pain_session", "nonexistent");
      expect(logs).toEqual([]);
    });
  });

  describe("clearLogs", () => {
    it("should clear all logs", () => {
      const event: AuditEvent = {
        userId: "user-123",
        action: "read",
        resourceType: "pain_session",
        resourceId: "session-456",
        timestamp: new Date(),
      };

      logger.logAccess(event);
      expect(logger.getAllLogs()).toHaveLength(1);

      logger.clearLogs();
      expect(logger.getAllLogs()).toHaveLength(0);
    });
  });

  describe("audit event structure", () => {
    it("should contain all required fields", () => {
      const event: AuditEvent = {
        userId: "user-123",
        action: "create",
        resourceType: "pain_marker",
        resourceId: "marker-456",
        timestamp: new Date("2024-01-15T10:00:00Z"),
      };

      logger.logAccess(event);

      const logs = logger.getAllLogs();
      const logEntry = logs[0];

      expect(logEntry).toHaveProperty("userId");
      expect(logEntry).toHaveProperty("action");
      expect(logEntry).toHaveProperty("resourceType");
      expect(logEntry).toHaveProperty("resourceId");
      expect(logEntry).toHaveProperty("timestamp");
    });

    it("should support various action types", () => {
      const actions = ["create", "read", "update", "delete"];

      actions.forEach((action, index) => {
        const event: AuditEvent = {
          userId: "user-123",
          action,
          resourceType: "pain_session",
          resourceId: `session-${index}`,
          timestamp: new Date(),
        };

        logger.logAccess(event);
      });

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(4);
      expect(logs.map((log) => log.action)).toEqual(actions);
    });

    it("should support various resource types", () => {
      const resourceTypes = [
        "pain_session",
        "pain_marker",
        "symptom_descriptor",
        "body_map",
        "insight_report",
      ];

      resourceTypes.forEach((resourceType, index) => {
        const event: AuditEvent = {
          userId: "user-123",
          action: "read",
          resourceType,
          resourceId: `resource-${index}`,
          timestamp: new Date(),
        };

        logger.logAccess(event);
      });

      const logs = logger.getAllLogs();
      expect(logs).toHaveLength(5);
      expect(logs.map((log) => log.resourceType)).toEqual(resourceTypes);
    });
  });
});
