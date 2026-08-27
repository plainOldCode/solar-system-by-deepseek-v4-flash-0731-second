/**
 * Central state hub that decouples core modules from UI modules.
 *
 * UI controls mutate application settings; core and UI both subscribe to
 * events. This keeps the entry point (main.ts) a thin assembly and prevents
 * one oversized controller from knowing about every module.
 */
import type { AppSettings } from "../types";
import {
  DEFAULT_DISTANCE_MODE,
  DEFAULT_SIZE_MODE,
  DEFAULT_TIME_SCALE_DAYS_PER_SECOND,
} from "../config/constants";

/** Events emitted by the store. All events use `never`-compatible payloads. */
export interface StoreEvents {
  /** A body was selected (id) or deselected (null). */
  select: { id: string | null };
  /** Pointer hover changed on a body (id) or left it (null). */
  hover: { id: string | null };
  /** One or more application settings changed. */
  settings: { settings: AppSettings };
  /** Request to return to the complete solar-system view. */
  resetView: Record<string, never>;
}

type Handler<T> = (payload: T) => void;
/** Internal erasure so a single unsafe cast keeps the public API fully typed. */
type HandlerRef = (payload: never) => void;

const DEFAULT_SETTINGS: AppSettings = {
  distanceMode: DEFAULT_DISTANCE_MODE,
  sizeMode: DEFAULT_SIZE_MODE,
  viewMode: "solar-system",
  playing: true,
  timeScaleDaysPerSecond: DEFAULT_TIME_SCALE_DAYS_PER_SECOND,
  showOrbits: true,
  showLabels: true,
  showMoons: true,
  showStarfield: true,
  uiHidden: false,
};

export class StateStore {
  private readonly handlers = new Map<string, Set<HandlerRef>>();
  private current: AppSettings;

  constructor(initial: Partial<AppSettings> = {}) {
    this.current = { ...DEFAULT_SETTINGS, ...initial };
  }

  /** Subscribe to an event; returns an unsubscribe function. */
  on<K extends keyof StoreEvents>(event: K, handler: Handler<StoreEvents[K]>): () => void {
    const key = event as string;
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set<HandlerRef>();
      this.handlers.set(key, set);
    }
    set.add(handler as unknown as HandlerRef);
    return () => {
      this.handlers.get(key)?.delete(handler as unknown as HandlerRef);
    };
  }

  emit<K extends keyof StoreEvents>(event: K, payload: StoreEvents[K]): void {
    const set = this.handlers.get(event as string);
    if (!set) return;
    for (const handlerRef of [...set]) {
      (handlerRef as unknown as Handler<StoreEvents[K]>)(payload);
    }
  }

  /** Current settings snapshot (copied to avoid external mutation). */
  getSettings(): AppSettings {
    return { ...this.current };
  }

  /** Apply a settings patch and broadcast the change. */
  setSettings(patch: Partial<AppSettings>): AppSettings {
    this.current = { ...this.current, ...patch };
    this.emit("settings", { settings: this.getSettings() });
    return this.getSettings();
  }
}
