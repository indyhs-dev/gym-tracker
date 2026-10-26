export type ExerciseType = 'compound' | 'isolation' | 'core';
export type WarmupPolicy = 'full' | 'one' | 'zeroToOne' | 'none';

export interface Exercise {
  id: string;
  name: string;
  /** Trimmed, single-spaced, lower-cased name. Unique, so names can't be duplicated. */
  nameKey: string;
  /** Weight entered is per dumbbell. */
  perHand: boolean;
  /** Weight entered is added load; 0 = bodyweight only. */
  bodyweight: boolean;
  /** kg, used by the +/- steppers. */
  weightStep: number;
  type: ExerciseType;
  createdAt: number;
}

export interface TemplateSlot {
  id: string;
  /** Default exercise. */
  exerciseId: string;
  alternativeIds: string[];
  targetSets: number;
  repMin: number;
  repMax: number;
  warmup: WarmupPolicy;
  planNote: string;
}

export interface Template {
  id: string;
  name: string;
  slots: TemplateSlot[];
  /** Position in the template list. */
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface WorkoutSet {
  id: string;
  /** kg; per hand if the exercise is perHand, added load if bodyweight. */
  weight: number | null;
  reps: number | null;
  warmup: boolean;
  note: string;
  /** When the set was created; used to suggest the session end time. */
  loggedAt: number;
}

export interface SessionExercise {
  id: string;
  /** The exercise actually done (after any swap). */
  exerciseId: string;
  /** Snapshot of the template slot when the session started; null if added ad hoc. */
  slot: TemplateSlot | null;
  note: string;
  sets: WorkoutSet[];
}

export interface Session {
  id: string;
  templateId: string | null;
  /** Snapshot of the template name; null = blank session. */
  templateName: string | null;
  status: 'active' | 'finished';
  /** Epoch ms; the session's local date is derived from this. */
  startedAt: number;
  endedAt: number | null;
  note: string;
  exercises: SessionExercise[];
  /** Derived from exercises; indexed for "last time I did X". */
  exerciseIds: string[];
  updatedAt: number;
}

export interface RestGuidance {
  warmup: string;
  compound: string;
  isolation: string;
  core: string;
}

export interface TrainingBlock {
  /** First day of the current training block ("YYYY-MM-DD"), or null if not tracking. */
  startDate: string | null;
  /** Remind to take a week off once the block is longer than this many weeks. */
  weekOffAfter: number;
}

export interface Settings {
  id: 'app';
  rest: RestGuidance;
  lastBackupAt: number | null;
  seededAt: number | null;
  block: TrainingBlock;
}
