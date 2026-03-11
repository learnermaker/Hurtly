// BodyTrace Core Data Model Types and Interfaces

// --- Geometry ---

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

// --- Core Anatomical Types ---

export interface AnatomicalRegion {
  id: string;
  name: string;
  bodySystem: string;
}

export interface AnatomicalLocation {
  region: AnatomicalRegion;
  coordinates: Vector3;
}

export interface AnatomicalBoundary {
  regions: AnatomicalRegion[];
  points: Vector3[];
}

// --- Pain Types and Scales ---

export type PainType =
  | "sharp"
  | "dull"
  | "burning"
  | "throbbing"
  | "aching"
  | "stabbing"
  | "tingling"
  | "numbness";

export type PainFrequency =
  | "constant"
  | "intermittent"
  | "occasional"
  | "only-during-activity";

export type PainDuration = "seconds" | "minutes" | "hours" | "days" | "weeks";

// --- Core Domain Models ---

export interface PainMarker {
  id: string;
  sessionId: string;
  location: AnatomicalLocation;
  boundary?: AnatomicalBoundary;
  intensity: number; // 0-10
  createdAt: Date;
  status: "active" | "resolved" | "historical";
}

export interface SymptomDescriptor {
  id: string;
  markerId: string;
  painType: PainType;
  intensity: number; // 0-10
  frequency: PainFrequency;
  duration: PainDuration;
  followUpResponses: FollowUpResponse[];
  completedAt: Date;
}

export interface FollowUpQuestion {
  id: string;
  text: string;
  context: {
    painType: PainType;
    region: AnatomicalRegion;
  };
}

export interface FollowUpResponse {
  questionId: string;
  questionText: string;
  response: string;
  answeredAt: Date;
}

export interface SymptomSignal {
  id: string;
  markerId: string;
  anatomicalRegion: string;
  painType: PainType;
  intensity: number; // 0-10
  frequency: PainFrequency;
  duration: PainDuration;
  timestamp: Date;
  followUpResponses?: FollowUpResponse[];
}

export interface PainSession {
  id: string;
  userId: string;
  markers: PainMarker[];
  descriptors: SymptomDescriptor[];
  status: "in-progress" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

export interface BodyMap {
  userId: string;
  sessions: PainSession[];
  markers: PainMarker[];
  descriptors: SymptomDescriptor[];
}

export interface MarkerFilter {
  dateRange?: { start: Date; end: Date };
  painTypes?: PainType[];
  intensityRange?: { min: number; max: number };
  regions?: string[];
}

// --- Timeline Types ---

export interface TimelineData {
  region: AnatomicalRegion;
  entries: TimelineEntry[];
}

export interface TimelineEntry {
  date: Date;
  intensity: number;
  painType: PainType;
  status: "appeared" | "active" | "resolved";
}

export type Trend = "worsening" | "improving" | "stable";

// --- Insight Report Types ---

export interface InsightReport {
  id: string;
  userId: string;
  generatedAt: Date;
  patterns: SymptomPattern[];
  frequencyTrends: FrequencyTrend[];
  intensityChanges: IntensityChange[];
  disclaimer: string;
}

export interface SymptomPattern {
  regions: string[];
  painTypes: PainType[];
  description: string;
}

export interface FrequencyTrend {
  region: string;
  trend: Trend;
  dataPoints: number;
}

export interface IntensityChange {
  region: string;
  fromIntensity: number;
  toIntensity: number;
  period: { start: Date; end: Date };
}

// --- Validation Types ---

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// --- Symptom Signal JSON Schema (for validation with ajv) ---

export const SYMPTOM_SIGNAL_SCHEMA = {
  type: "object",
  required: [
    "id",
    "markerId",
    "anatomicalRegion",
    "painType",
    "intensity",
    "frequency",
    "duration",
    "timestamp",
  ],
  properties: {
    id: { type: "string" },
    markerId: { type: "string" },
    anatomicalRegion: { type: "string" },
    painType: {
      type: "string",
      enum: [
        "sharp",
        "dull",
        "burning",
        "throbbing",
        "aching",
        "stabbing",
        "tingling",
        "numbness",
      ],
    },
    intensity: { type: "number", minimum: 0, maximum: 10 },
    frequency: {
      type: "string",
      enum: ["constant", "intermittent", "occasional", "only-during-activity"],
    },
    duration: {
      type: "string",
      enum: ["seconds", "minutes", "hours", "days", "weeks"],
    },
    timestamp: { type: "string", format: "date-time" },
  },
} as const;
