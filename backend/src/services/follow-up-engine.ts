import { v4 as uuidv4 } from "uuid";
import type {
  SymptomDescriptor,
  BodyMap,
  FollowUpQuestion,
  PainType,
  AnatomicalRegion,
} from "@bodytrace/shared";

/**
 * Question bank organized by pain type.
 * Questions use plain, non-medical language.
 */
const PAIN_TYPE_QUESTIONS: Record<PainType, string[]> = {
  sharp: [
    "Does the sharp feeling come on suddenly or build up over time?",
    "Does anything specific seem to trigger the sharp feeling?",
    "Does the sharpness get worse when you move a certain way?",
  ],
  dull: [
    "Is the dull feeling always there, or does it come and go?",
    "Does rest help reduce the dull feeling?",
    "Have you noticed the dull feeling spreading to nearby areas?",
  ],
  burning: [
    "Does the burning feeling stay in one spot or spread out?",
    "Does anything make the burning feeling better or worse?",
    "Is the skin in that area sensitive to touch?",
  ],
  throbbing: [
    "Does the throbbing follow a rhythm, like a heartbeat?",
    "Does the throbbing get worse when you stand up or move around?",
    "Does resting or lying down help with the throbbing?",
  ],
  aching: [
    "Does the ache feel deep inside or closer to the surface?",
    "Is the aching worse at certain times of day?",
    "Does stretching or gentle movement help with the ache?",
  ],
  stabbing: [
    "Does the stabbing feeling come in short bursts?",
    "Can you do anything that makes the stabbing feeling happen?",
    "Does the stabbing feeling take your breath away or stop you mid-action?",
  ],
  tingling: [
    "Does the tingling feel like pins and needles?",
    "Does the tingling spread from one area to another?",
    "Is the tingling worse after sitting or lying in one position?",
  ],
  numbness: [
    "Is the numbness complete, or can you still feel some sensation?",
    "Does the numbness come and go, or is it always there?",
    "Did the numbness start suddenly or develop gradually?",
  ],
};

/**
 * Region-specific questions for common anatomical areas.
 * Uses plain language.
 */
const REGION_QUESTIONS: Record<string, string[]> = {
  head: [
    "Do you also feel dizzy or lightheaded?",
    "Does light or noise make it worse?",
  ],
  neck: [
    "Can you turn your head fully in both directions?",
    "Does the discomfort go up into your head or down into your shoulders?",
  ],
  shoulder: [
    "Can you raise your arm above your head without trouble?",
    "Does it bother you more when reaching behind your back?",
  ],
  back: [
    "Does the feeling go down into your legs?",
    "Is it worse when you bend forward or lean back?",
  ],
  chest: [
    "Does breathing deeply change the feeling?",
    "Does the feeling get worse with physical activity?",
  ],
  arm: [
    "Do you have trouble gripping or holding things?",
    "Does the feeling go down to your hand or fingers?",
  ],
  hand: [
    "Is it harder to grip things or use your fingers?",
    "Do your fingers feel stiff in the morning?",
  ],
  hip: [
    "Does walking or climbing stairs make it worse?",
    "Is it harder to get up from a seated position?",
  ],
  knee: [
    "Does your knee feel unstable or like it might give out?",
    "Is it worse going up or down stairs?",
  ],
  leg: [
    "Does the feeling change when you walk or stand for a while?",
    "Is one leg affected more than the other?",
  ],
  foot: [
    "Is it worse when you first stand up in the morning?",
    "Does wearing certain shoes make it better or worse?",
  ],
  abdomen: [
    "Is the feeling related to eating or drinking?",
    "Does the feeling move around or stay in one spot?",
  ],
};

/**
 * Questions added when historical body map data is available.
 */
const HISTORY_QUESTIONS: string[] = [
  "Has this feeling changed since your last session?",
  "Is this the same kind of discomfort you reported before, or does it feel different?",
  "Have you tried anything new to manage this since last time?",
];

/**
 * Default fallback questions when generation fails.
 */
const DEFAULT_QUESTIONS_TEXT: string[] = [
  "How long have you been experiencing this?",
  "Does anything make it better or worse?",
  "Does this affect your daily activities?",
  "Have you noticed any patterns, like certain times of day?",
];

/**
 * Match a region name to a region key in the REGION_QUESTIONS bank.
 * Uses case-insensitive substring matching.
 */
function matchRegionKey(regionName: string): string | undefined {
  const lower = regionName.toLowerCase();
  return Object.keys(REGION_QUESTIONS).find((key) => lower.includes(key));
}

/**
 * Build a FollowUpQuestion object from text, pain type, and region.
 */
function buildQuestion(
  text: string,
  painType: PainType,
  region: AnatomicalRegion
): FollowUpQuestion {
  return {
    id: uuidv4(),
    text,
    context: { painType, region },
  };
}

/**
 * Generate context-aware follow-up questions based on the symptom descriptor
 * and optional historical body map data.
 *
 * Questions are selected based on:
 * 1. The pain type from the descriptor
 * 2. The anatomical region from the descriptor's linked marker
 * 3. Historical patterns when a body map is provided
 *
 * Always returns at least one question.
 *
 * Requirements: 4.1, 4.2, 4.3
 */
export function generateQuestions(
  descriptor: SymptomDescriptor,
  history?: BodyMap
): FollowUpQuestion[] {
  const painType = descriptor.painType;

  // We need a region for the question context. Derive from the descriptor's
  // markerId by looking it up in the history, or use a generic placeholder.
  const region = resolveRegion(descriptor, history);

  const questions: FollowUpQuestion[] = [];

  // 1. Pain-type-specific questions (pick first two)
  const painQuestions = PAIN_TYPE_QUESTIONS[painType] ?? [];
  for (const text of painQuestions.slice(0, 2)) {
    questions.push(buildQuestion(text, painType, region));
  }

  // 2. Region-specific questions (pick first one)
  const regionKey = matchRegionKey(region.name);
  if (regionKey) {
    const regionQuestions = REGION_QUESTIONS[regionKey];
    if (regionQuestions && regionQuestions.length > 0) {
      questions.push(buildQuestion(regionQuestions[0], painType, region));
    }
  }

  // 3. History-aware questions when body map data is available
  if (history && history.sessions.length > 0) {
    questions.push(buildQuestion(HISTORY_QUESTIONS[0], painType, region));
  }

  // Guarantee at least one question
  if (questions.length === 0) {
    questions.push(
      buildQuestion(DEFAULT_QUESTIONS_TEXT[0], painType, region)
    );
  }

  return questions;
}

/**
 * Resolve the anatomical region for a descriptor.
 * Looks up the marker in the history's markers list, or returns a generic region.
 */
function resolveRegion(
  descriptor: SymptomDescriptor,
  history?: BodyMap
): AnatomicalRegion {
  if (history) {
    const marker = history.markers.find((m) => m.id === descriptor.markerId);
    if (marker) {
      return marker.location.region;
    }
  }

  return {
    id: "general",
    name: "General",
    bodySystem: "general",
  };
}

/**
 * Get default fallback questions when the follow-up engine fails to generate
 * context-aware questions.
 *
 * Requirements: 4.5
 */
export function getDefaultQuestions(): FollowUpQuestion[] {
  const fallbackRegion: AnatomicalRegion = {
    id: "general",
    name: "General",
    bodySystem: "general",
  };

  return DEFAULT_QUESTIONS_TEXT.map((text) => ({
    id: uuidv4(),
    text,
    context: {
      painType: "aching" as PainType,
      region: fallbackRegion,
    },
  }));
}
