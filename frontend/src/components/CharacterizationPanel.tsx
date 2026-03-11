import { useState, useCallback } from "react";
import type {
  PainMarker,
  PainType,
  PainFrequency,
  PainDuration,
  SymptomDescriptor,
  FollowUpQuestion,
} from "@bodytrace/shared";

const PAIN_TYPES: PainType[] = [
  "sharp",
  "dull",
  "burning",
  "throbbing",
  "aching",
  "stabbing",
  "tingling",
  "numbness",
];

const FREQUENCIES: PainFrequency[] = [
  "constant",
  "intermittent",
  "occasional",
  "only-during-activity",
];

const DURATIONS: PainDuration[] = [
  "seconds",
  "minutes",
  "hours",
  "days",
  "weeks",
];

export interface CharacterizationPanelProps {
  marker: PainMarker;
  followUpQuestions?: FollowUpQuestion[];
  onComplete: (descriptor: SymptomDescriptor) => void;
  onFollowUpResponse?: (questionId: string, response: string) => void;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  marginBottom: 6,
  fontSize: 14,
};

const radioGroupStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 16,
};

const radioLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  cursor: "pointer",
  fontSize: 13,
  padding: "8px 12px", // Increased for 44x44px touch target
  borderRadius: 4,
  border: "1px solid #666", // Improved contrast
  minHeight: "44px", // WCAG touch target size
  minWidth: "44px",
};

const radioLabelSelectedStyle: React.CSSProperties = {
  ...radioLabelStyle,
  border: "2px solid #1565c0", // Darker blue for better contrast
  backgroundColor: "#e3f2fd",
  fontWeight: 600,
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

export default function CharacterizationPanel({
  marker,
  followUpQuestions = [],
  onComplete,
  onFollowUpResponse,
}: CharacterizationPanelProps) {
  const [painType, setPainType] = useState<PainType | null>(null);
  const [intensity, setIntensity] = useState<number>(marker.intensity);
  const [frequency, setFrequency] = useState<PainFrequency | null>(null);
  const [duration, setDuration] = useState<PainDuration | null>(null);
  const [followUpAnswers, setFollowUpAnswers] = useState<
    Record<string, string>
  >({});

  const regionName = marker.location.region.name;

  const handleFollowUpChange = useCallback(
    (questionId: string, response: string) => {
      setFollowUpAnswers((prev) => ({ ...prev, [questionId]: response }));
      onFollowUpResponse?.(questionId, response);
    },
    [onFollowUpResponse]
  );

  const isFormValid = painType !== null && frequency !== null && duration !== null;

  const handleComplete = useCallback(() => {
    if (!painType || !frequency || !duration) return;

    const descriptor: SymptomDescriptor = {
      id: crypto.randomUUID(),
      markerId: marker.id,
      painType,
      intensity,
      frequency,
      duration,
      followUpResponses: followUpQuestions
        .filter((q) => followUpAnswers[q.id]?.trim())
        .map((q) => ({
          questionId: q.id,
          questionText: q.text,
          response: followUpAnswers[q.id],
          answeredAt: new Date(),
        })),
      completedAt: new Date(),
    };

    onComplete(descriptor);
  }, [
    painType,
    intensity,
    frequency,
    duration,
    marker.id,
    followUpQuestions,
    followUpAnswers,
    onComplete,
  ]);

  return (
    <div
      role="form"
      aria-label={`Pain characterization for ${regionName}`}
      style={{
        padding: 20,
        maxWidth: 480,
        fontFamily: "system-ui, sans-serif",
        color: "#222",
      }}
    >
      <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>
        Characterize Pain: {regionName}
      </h2>

      {/* Pain Type */}
      <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
        <legend style={labelStyle}>Pain Type</legend>
        <div role="radiogroup" aria-label="Pain type selection" style={radioGroupStyle}>
          {PAIN_TYPES.map((type) => (
            <label
              key={type}
              style={painType === type ? radioLabelSelectedStyle : radioLabelStyle}
            >
              <input
                type="radio"
                name="painType"
                value={type}
                checked={painType === type}
                onChange={() => setPainType(type)}
                aria-label={`Pain type: ${capitalize(type)}`}
              />
              {capitalize(type)}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Intensity Slider */}
      <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
        <legend style={labelStyle}>
          Pain Intensity: {intensity}
        </legend>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span aria-hidden="true" style={{ fontSize: 12 }}>0 (None)</span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={intensity}
            onChange={(e) => setIntensity(Number(e.target.value))}
            aria-label={`Pain intensity scale, current value ${intensity}`}
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={intensity}
            style={{ flex: 1 }}
          />
          <span aria-hidden="true" style={{ fontSize: 12 }}>10 (Worst)</span>
        </div>
      </fieldset>

      {/* Frequency */}
      <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
        <legend style={labelStyle}>Frequency</legend>
        <div role="radiogroup" aria-label="Pain frequency selection" style={radioGroupStyle}>
          {FREQUENCIES.map((freq) => (
            <label
              key={freq}
              style={frequency === freq ? radioLabelSelectedStyle : radioLabelStyle}
            >
              <input
                type="radio"
                name="frequency"
                value={freq}
                checked={frequency === freq}
                onChange={() => setFrequency(freq)}
                aria-label={`Frequency: ${capitalize(freq)}`}
              />
              {capitalize(freq)}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Duration */}
      <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
        <legend style={labelStyle}>Duration</legend>
        <div role="radiogroup" aria-label="Pain duration selection" style={radioGroupStyle}>
          {DURATIONS.map((dur) => (
            <label
              key={dur}
              style={duration === dur ? radioLabelSelectedStyle : radioLabelStyle}
            >
              <input
                type="radio"
                name="duration"
                value={dur}
                checked={duration === dur}
                onChange={() => setDuration(dur)}
                aria-label={`Duration: ${capitalize(dur)}`}
              />
              {capitalize(dur)}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Follow-Up Questions */}
      {followUpQuestions.length > 0 && (
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
          <legend style={labelStyle}>Follow-Up Questions</legend>
          {followUpQuestions.map((q) => (
            <div key={q.id} style={{ marginBottom: 12 }}>
              <label
                htmlFor={`followup-${q.id}`}
                style={{ display: "block", fontSize: 13, marginBottom: 4 }}
              >
                {q.text}
              </label>
              <input
                id={`followup-${q.id}`}
                type="text"
                value={followUpAnswers[q.id] ?? ""}
                onChange={(e) => handleFollowUpChange(q.id, e.target.value)}
                aria-label={`Answer for: ${q.text}`}
                style={{
                  width: "100%",
                  padding: "10px 12px", // Increased for better touch target
                  fontSize: 13,
                  border: "1px solid #666", // Improved contrast
                  borderRadius: 4,
                  boxSizing: "border-box",
                  minHeight: "44px", // WCAG touch target size
                }}
              />
            </div>
          ))}
        </fieldset>
      )}

      {/* Complete Button */}
      <button
        type="button"
        onClick={handleComplete}
        disabled={!isFormValid}
        aria-label="Complete pain characterization"
        aria-disabled={!isFormValid}
        style={{
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 600,
          color: "#fff",
          backgroundColor: isFormValid ? "#1565c0" : "#757575", // Improved contrast
          border: "none",
          borderRadius: 6,
          cursor: isFormValid ? "pointer" : "not-allowed",
          minHeight: "44px", // WCAG touch target size
          minWidth: "120px",
        }}
      >
        Complete
      </button>
    </div>
  );
}
