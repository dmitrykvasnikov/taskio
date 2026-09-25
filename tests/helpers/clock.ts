import type { Clock } from '../../apps/api/src/app';

export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date { return new Date(this.current); }
  set(value: Date): void { this.current = new Date(value); }
}
