/**
 * Pure scale mapping functions.
 *
 * These convert REAL astronomical values into RENDERED scene values and are
 * the single place where the "real value vs rendered value" boundary lives.
 * They are pure (no renderer access) so they are trivially unit-testable.
 *
 * Two independent scales are handled:
 *  - heliocentric distance (Log / Linear / Focus)
 *  - body size (Enhanced / Relative / Uniform)
 * Moon orbits use their own local mapping so they never overlap their parent.
 */
import type { DistanceMode, SizeMode } from "../types";
import {
  MAX_DISTANCE_AU,
  MAX_RENDER_DISTANCE,
  MIN_RENDER_DISTANCE,
  SUN_RENDER_RADIUS,
  PLANET_RADIUS_MIN,
  PLANET_RADIUS_MAX,
  PLANET_RADIUS_ENHANCED_BASE,
  PLANET_RADIUS_ENHANCED_SCALE,
  MOON_RADIUS_MIN,
  MOON_RADIUS_MAX,
  MOON_RENDER_MIN_MULTIPLE,
  MOON_RENDER_MAX_MULTIPLE,
  EARTH_RADIUS_KM,
} from "../config/constants";

export class ScaleManager {
  /**
   * Distance (in AU) of the planetary system currently in focus.
   * Used only by the "focus" heliocentric mode to build a local window.
   */
  private focusDistanceAU: number | null = null;

  setFocusDistanceAU(distanceAU: number | null): void {
    this.focusDistanceAU = distanceAU;
  }

  getFocusDistanceAU(): number | null {
    return this.focusDistanceAU;
  }

  /**
   * Map a real heliocentric distance (AU) to a rendered scene distance.
   * Formula: normalized = log1p(d) / log1p(max), then remap to render range.
   */
  mapHeliocentricDistance(distanceAU: number, mode: DistanceMode): number {
    if (mode === "linear") {
      const norm = distanceAU / MAX_DISTANCE_AU;
      return MIN_RENDER_DISTANCE + norm * (MAX_RENDER_DISTANCE - MIN_RENDER_DISTANCE);
    }

    if (mode === "focus") {
      const focus = this.focusDistanceAU;
      if (focus === null || focus <= 0) return this.logMap(distanceAU);
      // Local log window centred on the focused system: spread = +/-1 order of
      // magnitude, mapped to ±spread units around the centre render distance.
      const center = MIN_RENDER_DISTANCE + (MAX_RENDER_DISTANCE - MIN_RENDER_DISTANCE) * 0.5;
      const spread = (MAX_RENDER_DISTANCE - MIN_RENDER_DISTANCE) * 0.4;
      const ratio = distanceAU / focus;
      const clamped = Math.max(-Math.log1p(10), Math.min(Math.log1p(10), Math.log1p(ratio)));
      return center + (clamped / Math.log1p(10)) * spread;
    }

    return this.logMap(distanceAU);
  }

  private logMap(distanceAU: number): number {
    const normalized = Math.log1p(distanceAU) / Math.log1p(MAX_DISTANCE_AU);
    return MIN_RENDER_DISTANCE + normalized * (MAX_RENDER_DISTANCE - MIN_RENDER_DISTANCE);
  }

  /**
   * Map a real moon distance (km from parent centre) to a rendered multiple of
   * the parent's displayed radius, in the 2.5..9 range.
   * Returns a MULTIPLE — the caller multiplies by the parent displayed radius.
   */
  mapSatelliteDistance(distanceKm: number, minKm: number, maxKm: number): number {
    const shifted = Math.max(0, distanceKm - minKm);
    const shiftedMax = Math.max(1, maxKm - minKm);
    const normalized = Math.log1p(shifted) / Math.log1p(shiftedMax);
    return (
      MOON_RENDER_MIN_MULTIPLE +
      normalized * (MOON_RENDER_MAX_MULTIPLE - MOON_RENDER_MIN_MULTIPLE)
    );
  }

  /** Fixed rendered radius of the Sun (all size modes keep it dominant). */
  sunRadius(): number {
    return SUN_RENDER_RADIUS;
  }

  /**
   * Map a real planet radius (km) to a rendered scene radius.
   * Enhanced: gentle square-root compression. Relative: leans toward the real
   * size ratios. Uniform: near-constant marker size.
   */
  mapPlanetRadius(radiusKm: number, mode: SizeMode): number {
    const ratio = radiusKm / EARTH_RADIUS_KM;
    if (mode === "relative") {
      return clamp(0.5 + 2.2 * Math.pow(ratio, 0.72), 0.5, 8);
    }
    if (mode === "uniform") {
      return clamp(1.0 + 0.08 * Math.log1p(ratio), 0.9, 2.4);
    }
    // enhanced (default): gentle sqrt curve, base floor keeps small bodies
    // visible AND lets Jupiter/Saturn stay clearly larger than Earth.
    return clamp(
      PLANET_RADIUS_ENHANCED_BASE +
        PLANET_RADIUS_ENHANCED_SCALE * Math.pow(ratio, 0.5),
      PLANET_RADIUS_MIN,
      PLANET_RADIUS_MAX,
    );
  }

  /**
   * Map a real moon radius (km) to a rendered scene radius.
   * Moons guarantee a minimum visible size in every mode.
   */
  mapMoonRadius(radiusKm: number, mode: SizeMode): number {
    const ratio = radiusKm / EARTH_RADIUS_KM;
    if (mode === "relative") {
      return clamp(0.08 + 0.7 * Math.pow(ratio, 0.6), 0.08, 1.5);
    }
    if (mode === "uniform") {
      return 0.3;
    }
    // enhanced (default)
    return clamp(
      MOON_RADIUS_MIN + (MOON_RADIUS_MAX - MOON_RADIUS_MIN) * Math.pow(ratio, 0.5),
      MOON_RADIUS_MIN,
      MOON_RADIUS_MAX,
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
