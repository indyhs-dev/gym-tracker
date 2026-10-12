import type { TrainingBlock } from '../db/types';
import { toDateInput } from './time';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar days from one "YYYY-MM-DD" to another (DST-proof: compares dates, not hours). */
function daysBetween(from: string, to: string): number {
  const utc = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

export interface BlockStatus {
  /** 1 on the start date and the 6 days after it, 2 the week after, and so on. 0 before it starts. */
  week: number;
  /** Weeks 1–2 of a block. */
  breakIn: boolean;
  /** Past the chosen number of weeks: time for a week off. */
  weekOffDue: boolean;
  /** Days until the block starts, if the start date is in the future. */
  startsIn: number;
}

export function blockStatus(block: TrainingBlock, now: number): BlockStatus | null {
  if (!block.startDate) return null;
  const days = daysBetween(block.startDate, toDateInput(now));
  if (days < 0) return { week: 0, breakIn: false, weekOffDue: false, startsIn: -days };
  const week = Math.floor(days / 7) + 1;
  return { week, breakIn: week <= 2, weekOffDue: week > block.weekOffAfter, startsIn: 0 };
}
