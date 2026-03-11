import { describe, it, expect, beforeEach } from "vitest";
import * as fc from "fast-check";
import { AuditLogger, AuditEvent } from "../audit-logger";

// Feature: body-trace, Property 23: Audit log content safety
// For any audit log entry, the entry should contain userId, action, resourceType,
// resourceId, and timestamp, but should not contain any symptom content
// (pain type, intensity, frequency, duration, or follow-up response text).
// **Validates: Requirements 9.5**

describe("Property 23: Audit log content safety", () => {
  let logger: AuditLogger;

  beforeEach(() => {
    logger = new AuditLogger();
  });

  it("should contain required fields but no symptom content", () => {
    // Arbitraries for generating valid audit events
    const userIdArb = fc.uuid().map((id) => `user-${id}`);
    const actionArb = fc.constantFrom("create", "read", "update", "delete");
    const resourceTypeArb = fc.constantFrom(
      "pain_session",
      "pain_marker",
      "symptom_descriptor",
      "body_map",
      "insight_report",
      "follow_up_response"
    );
    const resourceIdArb = fc.uuid().map((id) => `resource-${id}`);
    const timestampArb = fc.date();

    const auditEventArb = fc.record({
      userId: userIdArb,
      action: actionArb,
      resourceType: resourceTypeArb,
      resourceId: resourceIdArb,
      timestamp: timestampArb,
    });

    fc.assert(
      fc.property(auditEventArb, (event) => {
        // Log the event
        logger.logAccess(event);

        // Get the logged entry
        const logs = logger.getAllLogs();
        const logEntry = logs[logs.length - 1];

        // Verify required fields are present
        expect(logEntry).toHaveProperty("userId");
        expect(logEntry).toHaveProperty("action");
        expect(logEntry).toHaveProperty("resourceType");
        expect(logEntry).toHaveProperty("resourceId");
        expect(logEntry).toHaveProperty("timestamp");

        // Verify the values match
        expect(logEntry.userId).toBe(event.userId);
        expect(logEntry.action).toBe(event.action);
        expect(logEntry.resourceType).toBe(event.resourceType);
        expect(logEntry.resourceId).toBe(event.resourceId);
        expect(logEntry.timestamp).toEqual(event.timestamp);

        // Verify no symptom content fields are present
        expect(logEntry).not.toHaveProperty("painType");
        expect(logEntry).not.toHaveProperty("intensity");
        expect(logEntry).not.toHaveProperty("frequency");
        expect(logEntry).not.toHaveProperty("duration");
        expect(logEntry).not.toHaveProperty("followUpText");
        expect(logEntry).not.toHaveProperty("response");
        expect(logEntry).not.toHaveProperty("questionText");
        expect(logEntry).not.toHaveProperty("symptomDescriptor");
        expect(logEntry).not.toHaveProperty("descriptor");

        // Verify only the expected fields are present (no extra fields)
        const expectedFields = ["userId", "action", "resourceType", "resourceId", "timestamp"];
        const actualFields = Object.keys(logEntry);
        expect(actualFields.sort()).toEqual(expectedFields.sort());
      }),
      { numRuns: 20 }
    );
  });

  it("should reject events that contain symptom content fields", () => {
    // Arbitraries for generating events with forbidden fields
    const userIdArb = fc.uuid().map((id) => `user-${id}`);
    const actionArb = fc.constantFrom("create", "read", "update", "delete");
    const resourceTypeArb = fc.constantFrom(
      "pain_session",
      "pain_marker",
      "symptom_descriptor"
    );
    const resourceIdArb = fc.uuid().map((id) => `resource-${id}`);
    const timestampArb = fc.date();

    // Generate events with forbidden symptom content fields
    const forbiddenFieldArb = fc.constantFrom(
      "painType",
      "intensity",
      "frequency",
      "duration",
      "followUpText",
      "response",
      "questionText",
      "symptomDescriptor",
      "descriptor"
    );

    const painTypeArb = fc.constantFrom(
      "sharp",
      "dull",
      "burning",
      "throbbing",
      "aching",
      "stabbing",
      "tingling",
      "numbness"
    );
    const intensityArb = fc.integer({ min: 0, max: 10 });
    const frequencyArb = fc.constantFrom(
      "constant",
      "intermittent",
      "occasional",
      "only-during-activity"
    );
    const durationArb = fc.constantFrom("seconds", "minutes", "hours", "days", "weeks");
    const textArb = fc.string({ minLength: 1, maxLength: 100 });

    const forbiddenValueArb = fc.oneof(
      painTypeArb,
      intensityArb,
      frequencyArb,
      durationArb,
      textArb
    );

    const invalidEventArb = fc
      .record({
        userId: userIdArb,
        action: actionArb,
        resourceType: resourceTypeArb,
        resourceId: resourceIdArb,
        timestamp: timestampArb,
        forbiddenField: forbiddenFieldArb,
        forbiddenValue: forbiddenValueArb,
      })
      .map((record) => {
        const event: any = {
          userId: record.userId,
          action: record.action,
          resourceType: record.resourceType,
          resourceId: record.resourceId,
          timestamp: record.timestamp,
        };
        // Add the forbidden field
        event[record.forbiddenField] = record.forbiddenValue;
        return event;
      });

    fc.assert(
      fc.property(invalidEventArb, (event) => {
        // Attempting to log an event with symptom content should throw
        expect(() => logger.logAccess(event)).toThrow(
          "Audit log must not contain symptom content"
        );
      }),
      { numRuns: 20 }
    );
  });

  it("should maintain audit trail integrity across multiple events", () => {
    // Generate a sequence of valid audit events
    const userIdArb = fc.uuid().map((id) => `user-${id}`);
    const actionArb = fc.constantFrom("create", "read", "update", "delete");
    const resourceTypeArb = fc.constantFrom(
      "pain_session",
      "pain_marker",
      "symptom_descriptor",
      "body_map"
    );
    const resourceIdArb = fc.uuid().map((id) => `resource-${id}`);
    const timestampArb = fc.date();

    const auditEventArb = fc.record({
      userId: userIdArb,
      action: actionArb,
      resourceType: resourceTypeArb,
      resourceId: resourceIdArb,
      timestamp: timestampArb,
    });

    const eventSequenceArb = fc.array(auditEventArb, { minLength: 1, maxLength: 50 });

    fc.assert(
      fc.property(eventSequenceArb, (events) => {
        // Clear logs before each test
        logger.clearLogs();

        // Log all events
        events.forEach((event) => logger.logAccess(event));

        // Verify all events were logged
        const logs = logger.getAllLogs();
        expect(logs).toHaveLength(events.length);

        // Verify each logged event matches the original and has no symptom content
        logs.forEach((logEntry, index) => {
          const originalEvent = events[index];

          // Verify required fields match
          expect(logEntry.userId).toBe(originalEvent.userId);
          expect(logEntry.action).toBe(originalEvent.action);
          expect(logEntry.resourceType).toBe(originalEvent.resourceType);
          expect(logEntry.resourceId).toBe(originalEvent.resourceId);
          expect(logEntry.timestamp).toEqual(originalEvent.timestamp);

          // Verify no symptom content
          expect(logEntry).not.toHaveProperty("painType");
          expect(logEntry).not.toHaveProperty("intensity");
          expect(logEntry).not.toHaveProperty("frequency");
          expect(logEntry).not.toHaveProperty("duration");
          expect(logEntry).not.toHaveProperty("followUpText");
          expect(logEntry).not.toHaveProperty("response");
        });
      }),
      { numRuns: 20 }
    );
  });

  it("should filter logs by user without exposing symptom content", () => {
    const userIdArb = fc.uuid().map((id) => `user-${id}`);
    const actionArb = fc.constantFrom("create", "read", "update", "delete");
    const resourceTypeArb = fc.constantFrom("pain_session", "pain_marker", "body_map");
    const resourceIdArb = fc.uuid().map((id) => `resource-${id}`);
    const timestampArb = fc.date();

    const auditEventArb = fc.record({
      userId: userIdArb,
      action: actionArb,
      resourceType: resourceTypeArb,
      resourceId: resourceIdArb,
      timestamp: timestampArb,
    });

    const eventSequenceArb = fc.array(auditEventArb, { minLength: 5, maxLength: 20 });

    fc.assert(
      fc.property(eventSequenceArb, (events) => {
        // Clear logs before each test
        logger.clearLogs();

        // Log all events
        events.forEach((event) => logger.logAccess(event));

        // Pick a random user ID from the events
        if (events.length > 0) {
          const targetUserId = events[0].userId;

          // Get logs for that user
          const userLogs = logger.getLogsByUser(targetUserId);

          // Verify all returned logs belong to the target user
          userLogs.forEach((logEntry) => {
            expect(logEntry.userId).toBe(targetUserId);

            // Verify no symptom content in filtered results
            expect(logEntry).not.toHaveProperty("painType");
            expect(logEntry).not.toHaveProperty("intensity");
            expect(logEntry).not.toHaveProperty("frequency");
            expect(logEntry).not.toHaveProperty("duration");
          });

          // Verify count matches expected
          const expectedCount = events.filter((e) => e.userId === targetUserId).length;
          expect(userLogs).toHaveLength(expectedCount);
        }
      }),
      { numRuns: 20 }
    );
  });
});
