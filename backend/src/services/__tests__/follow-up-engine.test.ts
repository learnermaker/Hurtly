import { describe, it, expect } from "vitest";
import { generateQuestions, getDefaultQuestions } from "../follow-up-engine";
import type {
  SymptomDescriptor,
  BodyMap,
  PainMarker,
  PainType,
  FollowUpQuestion,
} from "@bodytrace/shared";

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

function createBodyMap(markers: PainMarker[] = [], sessionCount = 1): BodyMap {
  return {
    userId: "user-1",
    sessions: Array.from({ length: sessionCount }, (_, i) => ({
      id: `session-${i + 1}`,
      userId: "user-1",
      markers: [],
      descriptors: [],
      status: "completed" as const,
      createdAt: new Date("2024-01-15"),
      updatedAt: new Date("2024-01-15"),
    })),
    markers,
    descriptors: [],
  };
}

describe("FollowUpEngine", () => {
  describe("generateQuestions", () => {
    it("should return at least one question for any descriptor", () => {
      const descriptor = createDescriptor();
      const questions = generateQuestions(descriptor);

      expect(questions.length).toBeGreaterThanOrEqual(1);
    });

    it("should return questions with unique IDs", () => {
      const descriptor = createDescriptor();
      const questions = generateQuestions(descriptor);
      const ids = questions.map((q) => q.id);

      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should return questions with non-empty text", () => {
      const descriptor = createDescriptor();
      const questions = generateQuestions(descriptor);

      for (const q of questions) {
        expect(q.text.length).toBeGreaterThan(0);
      }
    });

    it("should include pain-type-specific questions for sharp pain", () => {
      const descriptor = createDescriptor({ painType: "sharp" });
      const questions = generateQuestions(descriptor);
      const texts = questions.map((q) => q.text);

      expect(texts.some((t) => t.toLowerCase().includes("sharp"))).toBe(true);
    });

    it("should include pain-type-specific questions for burning pain", () => {
      const descriptor = createDescriptor({ painType: "burning" });
      const questions = generateQuestions(descriptor);
      const texts = questions.map((q) => q.text);

      expect(texts.some((t) => t.toLowerCase().includes("burning"))).toBe(true);
    });

    it("should generate different questions for different pain types", () => {
      const sharpQuestions = generateQuestions(createDescriptor({ painType: "sharp" }));
      const numbQuestions = generateQuestions(createDescriptor({ painType: "numbness" }));

      const sharpTexts = sharpQuestions.map((q) => q.text);
      const numbTexts = numbQuestions.map((q) => q.text);

      // At least one question should differ
      expect(sharpTexts).not.toEqual(numbTexts);
    });

    it("should include region-specific questions when region is known via history", () => {
      const marker = createMarker({
        location: {
          region: { id: "lower-back", name: "Lower Back", bodySystem: "musculoskeletal" },
          coordinates: { x: 0, y: 1, z: -1 },
        },
      });
      const descriptor = createDescriptor({ markerId: marker.id });
      const history = createBodyMap([marker]);

      const questions = generateQuestions(descriptor, history);
      const texts = questions.map((q) => q.text);

      // Should include a back-related question
      expect(
        texts.some((t) => t.toLowerCase().includes("leg") || t.toLowerCase().includes("bend"))
      ).toBe(true);
    });

    it("should include history-aware questions when body map has sessions", () => {
      const marker = createMarker();
      const history = createBodyMap([marker], 2);
      const descriptor = createDescriptor();

      const questions = generateQuestions(descriptor, history);
      const texts = questions.map((q) => q.text);

      expect(texts.some((t) => t.toLowerCase().includes("last session"))).toBe(true);
    });

    it("should not include history questions when no history is provided", () => {
      const descriptor = createDescriptor();
      const questions = generateQuestions(descriptor);
      const texts = questions.map((q) => q.text);

      expect(texts.some((t) => t.toLowerCase().includes("last session"))).toBe(false);
    });

    it("should not include history questions when history has no sessions", () => {
      const descriptor = createDescriptor();
      const emptyHistory = createBodyMap([], 0);
      const questions = generateQuestions(descriptor, emptyHistory);
      const texts = questions.map((q) => q.text);

      expect(texts.some((t) => t.toLowerCase().includes("last session"))).toBe(false);
    });

    it("should set correct context on each question", () => {
      const marker = createMarker();
      const history = createBodyMap([marker]);
      const descriptor = createDescriptor({ painType: "throbbing" });

      const questions = generateQuestions(descriptor, history);

      for (const q of questions) {
        expect(q.context.painType).toBe("throbbing");
        expect(q.context.region).toBeDefined();
        expect(q.context.region.id).toBeDefined();
        expect(q.context.region.name).toBeDefined();
      }
    });

    it("should use plain language without medical jargon", () => {
      const painTypes: PainType[] = [
        "sharp", "dull", "burning", "throbbing",
        "aching", "stabbing", "tingling", "numbness",
      ];
      const medicalTerms = [
        "diagnosis", "prognosis", "pathology", "etiology",
        "bilateral", "unilateral", "chronic", "acute",
        "inflammation", "neuropathy", "radiculopathy",
      ];

      for (const painType of painTypes) {
        const questions = generateQuestions(createDescriptor({ painType }));
        for (const q of questions) {
          const lower = q.text.toLowerCase();
          for (const term of medicalTerms) {
            expect(lower).not.toContain(term);
          }
        }
      }
    });

    it("should use a generic region when marker is not found in history", () => {
      const descriptor = createDescriptor({ markerId: "nonexistent-marker" });
      const history = createBodyMap([]);

      const questions = generateQuestions(descriptor, history);

      expect(questions.length).toBeGreaterThanOrEqual(1);
      // Should still work, just with a generic region
      expect(questions[0].context.region.id).toBe("general");
    });

    it("should handle all eight pain types", () => {
      const painTypes: PainType[] = [
        "sharp", "dull", "burning", "throbbing",
        "aching", "stabbing", "tingling", "numbness",
      ];

      for (const painType of painTypes) {
        const questions = generateQuestions(createDescriptor({ painType }));
        expect(questions.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("getDefaultQuestions", () => {
    it("should return at least one question", () => {
      const questions = getDefaultQuestions();
      expect(questions.length).toBeGreaterThanOrEqual(1);
    });

    it("should return questions with unique IDs", () => {
      const questions = getDefaultQuestions();
      const ids = questions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should return questions with non-empty text", () => {
      const questions = getDefaultQuestions();
      for (const q of questions) {
        expect(q.text.length).toBeGreaterThan(0);
      }
    });

    it("should return questions with valid context structure", () => {
      const questions = getDefaultQuestions();
      for (const q of questions) {
        expect(q.context).toBeDefined();
        expect(q.context.painType).toBeDefined();
        expect(q.context.region).toBeDefined();
        expect(q.context.region.id).toBeDefined();
        expect(q.context.region.name).toBeDefined();
      }
    });

    it("should use plain language", () => {
      const questions = getDefaultQuestions();
      const medicalTerms = [
        "diagnosis", "prognosis", "pathology", "etiology",
        "bilateral", "unilateral", "neuropathy",
      ];

      for (const q of questions) {
        const lower = q.text.toLowerCase();
        for (const term of medicalTerms) {
          expect(lower).not.toContain(term);
        }
      }
    });

    it("should generate new unique IDs on each call", () => {
      const first = getDefaultQuestions();
      const second = getDefaultQuestions();

      const firstIds = first.map((q) => q.id);
      const secondIds = second.map((q) => q.id);

      // IDs from different calls should not overlap
      for (const id of firstIds) {
        expect(secondIds).not.toContain(id);
      }
    });
  });
});
