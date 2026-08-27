/**
 * Central configuration constants.
 *
 * All scale "magic numbers" and UI defaults live here so that data, rendering
 * and UI modules reference named constants instead of inline literals.
 * Tuning these values must never change the module contracts.
 */

import type { DistanceMode, SizeMode } from "../types";

/** Rendering pixel ratio is capped to keep high-DPI displays performant. */
export const MAX_PIXEL_RATIO = 2;

/**
 * Initial whole-system camera framing (slightly oblique so orbital
 * inclinations and depth are readable). Used by the reset / Back / whole-view
 * actions to return to the initial composition.
 */
export const INITIAL_CAMERA_POSITION = { x: 120, y: 95, z: 195 } as const;

/** Duration of a camera/selection focus tween (ms). */
export const FOCUS_EASE_DURATION_MS = 1100;

/** Vertical fraction of the viewport the focused system should occupy. */
export const FOCUS_FILL_RATIO = 0.72;

/** Reference planet to which size ratios are normalized. */
export const EARTH_RADIUS_KM = 6371;

/** Fixed rendered radius of the Sun (scene units). */
export const SUN_RENDER_RADIUS = 8;

/** Approximate Pluto orbital scale used to bound the log mapping. */
export const MAX_DISTANCE_AU = 39.5;

/** Scene-space heliocentric render range. */
export const MIN_RENDER_DISTANCE = 16;
export const MAX_RENDER_DISTANCE = 190;

/** Moon orbit is wrapped to 2.5..9 times the parent's displayed radius. */
export const MOON_RENDER_MIN_MULTIPLE = 2.5;
export const MOON_RENDER_MAX_MULTIPLE = 9;

/**
 * Enhanced planet size mapping:
 *   rendered = PLANET_RADIUS_ENHANCED_BASE
 *            + PLANET_RADIUS_ENHANCED_SCALE * (radiusKm / EARTH_RADIUS_KM)^0.5
 * The gentle square-root curve keeps real size RATIOS visible (so Jupiter and
 * Saturn stay clearly larger than Earth) while the base floor keeps small
 * bodies (Mercury, Pluto) identifiable. `PLANET_RADIUS_MIN/MAX` only clamp the
 * output — the curve itself must not saturate before the giant planets.
 */
export const PLANET_RADIUS_ENHANCED_BASE = 0.55;
export const PLANET_RADIUS_ENHANCED_SCALE = 0.65;
/** Lower/upper bounds for the enhanced size mapping (planet). */
export const PLANET_RADIUS_MIN = 0.55;
export const PLANET_RADIUS_MAX = 4.0;

/** Lower/upper bounds for the enhanced size mapping (moon). */
export const MOON_RADIUS_MIN = 0.16;
export const MOON_RADIUS_MAX = 0.75;

/** Default time-scale presets expressed as simulation days per real second. */
export const TIME_SCALES_DAYS_PER_SECOND = [1, 10, 100, 365] as const;
/** Default initial simulation speed. */
export const DEFAULT_TIME_SCALE_DAYS_PER_SECOND = 10;
/** Simulation reference epoch used only for the date display. */
export const SIM_EPOCH_YEAR = 2000;
export const SIM_EPOCH_DAY = 1;

export const DEFAULT_DISTANCE_MODE: DistanceMode = "log";
export const DEFAULT_SIZE_MODE: SizeMode = "enhanced";

/** Mobile breakpoint in CSS pixels (star/label density is reduced below it). */
export const MOBILE_BREAKPOINT_PX = 720;

/** Orbit line geometry sampling steps (built once, reused every frame). */
export const ORBIT_SEGMENTS = 256;

/** Generic selectable presets that UI controls enumerate. */
export const DISTANCE_MODES: ReadonlyArray<{ value: DistanceMode; label: string }> = [
  { value: "log", label: "Log Scale (기본)" },
  { value: "linear", label: "Linear Scale" },
  { value: "focus", label: "Focus Scale" },
];

export const SIZE_MODES: ReadonlyArray<{ value: SizeMode; label: string }> = [
  { value: "enhanced", label: "Enhanced Visibility (기본)" },
  { value: "relative", label: "Relative Size" },
  { value: "uniform", label: "Uniform Markers" },
];

/**
 * Required scale disclaimer text. The UI must surface this so the user knows
 * distance and size do not share one uniform physical scale.
 */
export const SCALE_DISCLAIMER =
  "실제 천문 데이터를 사용하되, 궤도 거리는 로그 스케일(Log Scale)로 압축하고 " +
  "천체 크기는 가시성을 위해 확대했습니다. 즉 크기는 물리적 배율과 무관합니다. " +
  "(Real data, but orbital distance uses a logarithmic scale and body sizes are " +
  "visually enlarged — rendered size is unrelated to physical scale.)";

/** Keyboard shortcut that toggles the whole UI overlay. */
export const UI_HIDE_KEY = "h";
