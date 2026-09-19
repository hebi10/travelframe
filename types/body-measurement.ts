export type BodyMeasurementMetric =
  | "weight"
  | "bodyFat"
  | "skeletalMuscle"
  | "waist";

export type BodyMeasurementFields = {
  weight: boolean;
  bodyFat: boolean;
  skeletalMuscle: boolean;
  waist: boolean;
};

export type BodyMeasurementSettings = {
  enabled: boolean;
  fields: BodyMeasurementFields;
  primaryMetric: BodyMeasurementMetric;
  promptAfterCapture: boolean;
};

export type BodyMeasurementEntry = {
  id: string;
  projectId: string;
  photoId?: string;
  sequence?: number;
  recordedAt: string;
  weightKg?: number;
  bodyFatPercent?: number;
  skeletalMuscleKg?: number;
  waistCm?: number;
  note?: string;
  source: "manual" | "health_connect";
  sourceRecordId?: string;
  sourceAppPackage?: string;
};

export const defaultBodyMeasurementSettings: BodyMeasurementSettings = {
  enabled: false,
  fields: {
    weight: true,
    bodyFat: false,
    skeletalMuscle: false,
    waist: false
  },
  primaryMetric: "weight",
  promptAfterCapture: false
};

export const bodyMeasurementMetricMeta: Record<
  BodyMeasurementMetric,
  { label: string; unit: string }
> = {
  weight: { label: "몸무게", unit: "kg" },
  bodyFat: { label: "체지방률", unit: "%" },
  skeletalMuscle: { label: "골격근량", unit: "kg" },
  waist: { label: "허리둘레", unit: "cm" }
};
