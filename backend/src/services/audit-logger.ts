/**
 * Audit Logger Service
 * 
 * Logs data access events for audit purposes without recording symptom content.
 * Validates: Requirements 9.5
 */

export interface AuditEvent {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: Date;
}

/**
 * Forbidden fields that contain symptom content and must not be logged
 */
const FORBIDDEN_FIELDS = [
  "painType",
  "intensity",
  "frequency",
  "duration",
  "followUpText",
  "response",
  "questionText",
  "symptomDescriptor",
  "descriptor",
] as const;

export class AuditLogger {
  private logs: AuditEvent[] = [];

  /**
   * Log a data access event
   * @param event - The audit event to log
   * @throws Error if the event contains symptom content
   */
  logAccess(event: AuditEvent): void {
    // Validate that the event doesn't contain forbidden symptom content fields
    this.validateNoSymptomContent(event);

    // Create a clean event with only allowed fields
    const cleanEvent: AuditEvent = {
      userId: event.userId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      timestamp: event.timestamp,
    };

    this.logs.push(cleanEvent);
  }

  /**
   * Validate that an event doesn't contain symptom content
   * @param event - The event to validate
   * @throws Error if forbidden fields are present
   */
  private validateNoSymptomContent(event: any): void {
    for (const field of FORBIDDEN_FIELDS) {
      if (field in event) {
        throw new Error("Audit log must not contain symptom content");
      }
    }
  }

  /**
   * Get all logged events
   * @returns Array of all audit events
   */
  getAllLogs(): AuditEvent[] {
    return [...this.logs];
  }

  /**
   * Get logs for a specific user
   * @param userId - The user ID to filter by
   * @returns Array of audit events for the specified user
   */
  getLogsByUser(userId: string): AuditEvent[] {
    return this.logs.filter((log) => log.userId === userId);
  }

  /**
   * Get logs for a specific resource
   * @param resourceType - The type of resource
   * @param resourceId - The resource ID
   * @returns Array of audit events for the specified resource
   */
  getLogsByResource(resourceType: string, resourceId: string): AuditEvent[] {
    return this.logs.filter(
      (log) => log.resourceType === resourceType && log.resourceId === resourceId
    );
  }

  /**
   * Clear all logs (primarily for testing)
   */
  clearLogs(): void {
    this.logs = [];
  }
}
