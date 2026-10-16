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

export interface SaunaSettings {
  /** Sessions per week (Monday–Sunday) to aim for. */
  weeklyTarget: number;
  /** When the sample sessions were added (or would have been); null = not yet. */
  samplesAddedAt: number | null;
}

export interface Settings {
  id: 'app';
  rest: RestGuidance;
  lastBackupAt: number | null;
  seededAt: number | null;
  block: TrainingBlock;
  sauna: SaunaSettings;
}

// ---- Sauna ----

export type SaunaContext = 'afterLifting' | 'afterCardio' | 'standalone';
export type SaunaBench = 'upper' | 'lower';
export type SaunaTemp = 'low' | 'mid' | 'high';
export type SaunaExitReason = 'tooHot' | 'dehydrated' | 'tired' | 'other';
export type SaunaSkipReason = 'rest' | 'sick' | 'closed' | 'other';
export type SaunaFeel = 1 | 2 | 3 | 4 | 5;

export interface SaunaRound {
  /** Planned length in minutes (15 or 20). */
  plannedMin: number;
  /** Time left on the phone timer when leaving early, in seconds. 0 = completed. Kept to show the round as entered. */
  leftSec: number;
  /** Seconds actually done = planned − left. Every chart and stat uses this. */
  completedSec: number;
  /** Why the round ended early (optional; only when leftSec > 0). */
  reason: SaunaExitReason | null;
}

interface SaunaEntryBase {
  id: string;
  /** Calendar day in Australia/Brisbane, "YYYY-MM-DD". */
  date: string;
  /** Added by the sample-data seed (removable from Settings → Sauna). */
  sample?: true;
  createdAt: number;
  updatedAt: number;
}

export interface SaunaSession extends SaunaEntryBase {
  kind: 'session';
  context: SaunaContext;
  rounds: SaunaRound[];
  bench: SaunaBench;
  temp: SaunaTemp | null;
  /** 1 = survivable, 3 = comfortable, 5 = easy. */
  feel: SaunaFeel;
  water: boolean;
}

/** A gym day without the sauna. Never counts against the weekly target. */
export interface SaunaSkip extends SaunaEntryBase {
  kind: 'skip';
  reason: SaunaSkipReason;
}

export type SaunaEntry = SaunaSession | SaunaSkip;
