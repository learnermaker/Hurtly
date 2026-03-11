import { v4 as uuidv4 } from "uuid";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import type {
  PainMarker,
  SymptomDescriptor,
  SymptomSignal,
  ValidationResult,
} from "@bodytrace/shared";
import { SYMPTOM_SIGNAL_SCHEMA } from "@bodytrace/shared";

const ajv = new Ajv();
addFormats(ajv);

const validateSchema = ajv.compile(SYMPTOM_SIGNAL_SCHEMA);

/**
 * Generate a SymptomSignal from a PainMarker and SymptomDescriptor.
 */
export function generate(
  marker: PainMarker,
  descriptor: SymptomDescriptor
): SymptomSignal {
  return {
    id: uuidv4(),
    markerId: marker.id,
    anatomicalRegion: marker.location.region.name,
    painType: descriptor.painType,
    intensity: descriptor.intensity,
    frequency: descriptor.frequency,
    duration: descriptor.duration,
    timestamp: new Date(),
    followUpResponses:
      descriptor.followUpResponses.length > 0
        ? descriptor.followUpResponses
        : undefined,
  };
}

/**
 * Serialize a SymptomSignal to a JSON string.
 * Converts Date objects to ISO strings.
 */
export function serialize(signal: SymptomSignal): string {
  return JSON.stringify(signal, (_key, value) => {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  });
}

/**
 * Parse a JSON string into a SymptomSignal.
 * Converts ISO date strings back to Date objects.
 */
export function parse(json: string): SymptomSignal {
  return JSON.parse(json, (key, value) => {
    if (key === "timestamp" && typeof value === "string") {
      return new Date(value);
    }
    if (key === "answeredAt" && typeof value === "string") {
      return new Date(value);
    }
    return value;
  }) as SymptomSignal;
}

/**
 * Validate a SymptomSignal against the SYMPTOM_SIGNAL_SCHEMA using ajv.
 */
export function validate(signal: SymptomSignal): ValidationResult {
  // Convert to a plain object with timestamp as ISO string for schema validation
  const plain = {
    ...signal,
    timestamp:
      signal.timestamp instanceof Date
        ? signal.timestamp.toISOString()
        : signal.timestamp,
  };

  const valid = validateSchema(plain);

  if (valid) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: validateSchema.errors?.map(
      (e) => `${e.instancePath} ${e.message}`
    ),
  };
}
