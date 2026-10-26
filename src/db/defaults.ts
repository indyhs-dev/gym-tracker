import type { RestGuidance, Settings } from './types';

export const DEFAULT_WEEK_OFF_AFTER = 12;

export const DEFAULT_REST: RestGuidance = {
  warmup: '1–2 min',
  compound: '3–5 min',
  isolation: '90 s–3 min',
  core: '60–90 s',
};

export function defaultSettings(): Settings {
  return {
    id: 'app',
    rest: { ...DEFAULT_REST },
    lastBackupAt: null,
    seededAt: null,
    block: { startDate: null, weekOffAfter: DEFAULT_WEEK_OFF_AFTER },
  };
}
