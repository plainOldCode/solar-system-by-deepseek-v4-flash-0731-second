/**
 * Accumulates simulation time from REAL elapsed wall-clock time, not frame
 * count, so motion is consistent at any frame rate.
 *
 * Speed is expressed as "simulation days per real second" and scales every
 * body by the ratio of its real orbital period — no per-body arbitrary speed.
 */
import {
  DEFAULT_TIME_SCALE_DAYS_PER_SECOND,
  SIM_EPOCH_DAY,
  SIM_EPOCH_YEAR,
  TIME_SCALES_DAYS_PER_SECOND,
} from "../config/constants";

export const SUPPORTED_TIME_SCALES: ReadonlyArray<number> = TIME_SCALES_DAYS_PER_SECOND;

export class SimulationClock {
  private elapsedDays = 0;
  private playing = true;
  private timeScaleDaysPerSecond = DEFAULT_TIME_SCALE_DAYS_PER_SECOND;

  /** Advance the simulation by real elapsed milliseconds. */
  update(realDeltaMs: number): void {
    if (!this.playing) return;
    this.elapsedDays += (realDeltaMs / 1000) * this.timeScaleDaysPerSecond;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setTimeScale(daysPerSecond: number): void {
    this.timeScaleDaysPerSecond =
      SUPPORTED_TIME_SCALES.find((s) => s === daysPerSecond) ?? daysPerSecond;
  }

  getTimeScale(): number {
    return this.timeScaleDaysPerSecond;
  }

  /** Reset the simulation to the reference epoch. */
  reset(): void {
    this.elapsedDays = 0;
  }

  getElapsedDays(): number {
    return this.elapsedDays;
  }

  /** Format the current simulated date as "YYYY-MM-DD". */
  dateLabel(): string {
    const ms =
      Date.UTC(SIM_EPOCH_YEAR, 0, SIM_EPOCH_DAY) + this.elapsedDays * 86_400_000;
    const d = new Date(ms);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}
