import { describe, it, expect } from "vitest";
import {
  generate,
  serialize,
  parse,
  validate,
} from "../symptom-signal-generator";
import type {
  PainMarker,
  SymptomDescriptor,
  SymptomSignal,
} from "@bodytrace/shared";

function createMarker(overrides?: Partial<PainMarker>): PainMarker {
  return {
    id: "marker-1",
    sessionId: "session-1",
    location: {
      region: { id: "left-shoulder", name: "Left Shoulder", bodySystem: "musculoskeletal" },
      coordinates: { x: 1, y: 2, z: 3 },
    },
    intensity: 7,
    createdAt: new Date("2024-01-15"),
    status: "active",
    ...overrides,
  };
}

function createDescriptor(overrides?: Partial<SymptomDescriptor>): SymptomDescriptor {
  return {
    id: "desc-1",
    markerId: "marker-1",
    painType: "sharp",
    intensity: 7,
    frequency: "intermittent",
    duration: "hours",
    followUpResponses: [],
    completedAt: new Date("2024-01-15"),
    ...overrides,
  };
}

describe("SymptomSignalGenerator", () => {
  describe("generate", () => {
    it("should produce a SymptomSignal with a unique ID", () => {
      const marker = createMarker();
      const descriptor = createDescriptor();
      const signal = generate(marker, descriptor);

      expect(signal.id).toBeDefined();
      expect(typeof signal.id).toBe("string");
      expect(signal.id.length).toBeGreaterThan(0);
    });

    it("should copy marker ID and anatomical region name", () => {
      const marker = createMarker();
      const descriptor = createDescriptor();
      const signal = generate(marker, descriptor);

      expect(signal.markerId).toBe("marker-1");
      expect(signal.anatomicalRegion).toBe("Left Shoulder");
    });

    it("should copy descriptor fields", () => {
      const marker = createMarker();
      const descriptor = createDescriptor();
      const signal = generate(marker, descriptor);

      expect(signal.painType).toBe("sharp");
      expect(signal.intensity).toBe(7);
      expect(signal.frequency).toBe("intermittent");
      expect(signal.duration).toBe("hours");
    });

    it("should set timestamp to current date", () => {
      const before = new Date();
      const signal = generate(createMarker(), createDescriptor());
      const after = new Date();

      expect(signal.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(signal.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should include followUpResponses when present", () => {
      const descriptor = createDescriptor({
        followUpResponses: [
          {
            questionId: "q1",
            questionText: "Does it hurt when you move?",
            response: "Yes",
            answeredAt: new Date("2024-01-15"),
          },
        ],
      });
      const signal = generate(createMarker(), descriptor);

      expect(signal.followUpResponses).toHaveLength(1);
      expect(signal.followUpResponses![0].response).toBe("Yes");
    });

    it("should set followUpResponses to undefined when empty", () => {
      const signal = generate(createMarker(), createDescriptor());
      expect(signal.followUpResponses).toBeUndefined();
    });

    it("should generate unique IDs for different calls", () => {
      const marker = createMarker();
      const descriptor = createDescriptor();
      const signal1 = generate(marker, descriptor);
      const signal2 = generate(marker, descriptor);

      expect(signal1.id).not.toBe(signal2.id);
    });
  });

  describe("serialize", () => {
    it("should produce valid JSON", () => {
      const signal = generate(createMarker(), createDescriptor());
      const json = serialize(signal);

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("should convert Date to ISO string", () => {
      const signal = generate(createMarker(), createDescriptor());
      const json = serialize(signal);
      const parsed = JSON.parse(json);

      expect(typeof parsed.timestamp).toBe("string");
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });
  });

  describe("parse", () => {
    it("should convert ISO timestamp string back to Date", () => {
      const signal = generate(createMarker(), createDescriptor());
      const json = serialize(signal);
      const restored = parse(json);

      expect(restored.timestamp).toBeInstanceOf(Date);
    });

    it("should restore all fields correctly", () => {
      const signal = generate(createMarker(), createDescriptor());
      const json = serialize(signal);
      const restored = parse(json);

      expect(restored.id).toBe(signal.id);
      expect(restored.markerId).toBe(signal.markerId);
      expect(restored.anatomicalRegion).toBe(signal.anatomicalRegion);
      expect(restored.painType).toBe(signal.painType);
      expect(restored.intensity).toBe(signal.intensity);
      expect(restored.frequency).toBe(signal.frequency);
      expect(restored.duration).toBe(signal.duration);
    });

    it("should restore followUpResponses with Date fields", () => {
      const descriptor = createDescriptor({
        followUpResponses: [
          {
            questionId: "q1",
            questionText: "When did it start?",
            response: "Yesterday",
            answeredAt: new Date("2024-01-14T10:00:00.000Z"),
          },
        ],
      });
      const signal = generate(createMarker(), descriptor);
      const json = serialize(signal);
      const restored = parse(json);

      expect(restored.followUpResponses).toHaveLength(1);
      expect(restored.followUpResponses![0].answeredAt).toBeInstanceOf(Date);
    });
  });

  describe("validate", () => {
    it("should return valid for a correct signal", () => {
      const signal = generate(createMarker(), createDescriptor());
      const result = validate(signal);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it("should return invalid for missing required fields", () => {
      const signal = { id: "test" } as unknown as SymptomSignal;
      const result = validate(signal);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it("should return invalid for out-of-range intensity", () => {
      const signal = generate(createMarker(), createDescriptor());
      (signal as any).intensity = 15;
      const result = validate(signal);

      expect(result.valid).toBe(false);
    });

    it("should return invalid for unknown pain type", () => {
      const signal = generate(createMarker(), createDescriptor());
      (signal as any).painType = "unknown-type";
      const result = validate(signal);

      expect(result.valid).toBe(false);
    });
  });
});
