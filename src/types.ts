/**
 * Shared domain types across data / core / ui modules.
 * These define the type-safe contract between celestial data, scale functions,
 * render engine, simulation, UI and selection state.
 */

/** Type of a celestial body. */
export type BodyType = "star" | "planet" | "dwarf-planet" | "moon";

/** Unit of a stored semi-major axis. */
export type LengthUnit = "AU" | "km";

/** Selectable heliocentric distance representation. */
export type DistanceMode = "log" | "linear" | "focus";

/** Selectable celestial-body size representation. */
export type SizeMode = "enhanced" | "relative" | "uniform";

/** Camera framing mode: whole system vs one planetary system. */
export type ViewMode = "solar-system" | "planetary-system";

/**
 * Raw astronomical record for one celestial body.
 * All values here are REAL data (radius / distance / periods / eccentricity /
 * inclination / parent) and must never be mixed with rendered display values.
 */
export interface CelestialBodyData {
  /** Stable unique identifier, e.g. "planet.saturn" or "moon.titan". */
  id: string;
  /** Korean display name. */
  nameKo: string;
  /** English display name. */
  nameEn: string;
  type: BodyType;
  /** Id of the parent body (planets -> star, moons -> planet). */
  parentId?: string;

  /** Actual radius in kilometres. */
  radiusKm: number;
  /** Semi-major axis of the orbit around parent (omitted for the star). */
  semiMajorAxis?: number;
  /** Unit of `semiMajorAxis`; default "km" for moons. */
  semiMajorAxisUnit?: LengthUnit;
  /** Orbital eccentricity (0 = circular). */
  eccentricity?: number;
  /** Orbital inclination in degrees relative to reference plane. */
  inclinationDeg?: number;
  /** Sidereal orbital period in days. */
  orbitalPeriodDays?: number;
  /** Rotation period in hours. */
  rotationPeriodHours?: number;
  /** Axial tilt in degrees. */
  axialTiltDeg?: number;

  /** Procedural display color (hex string). */
  displayColor: string;
  /** Optional human-readable description. */
  description?: string;

  /**
   * Source of all REAL values on this record (e.g. the NASA/JPL Planetary Fact
   * Sheet and its citation URL). Kept per body so provenance is never lost.
   */
  source: string;

  /** True when the body renders visible rings. */
  hasRings?: boolean;
  /** Ring inner radius in km (relative to body). */
  ringInnerKm?: number;
  /** Ring outer radius in km (relative to body). */
  ringOuterKm?: number;
}

/**
 * Indexing of all bodies: a lookup by id plus the ordered list of
 * direct children per parent id (used by both render and UI modules).
 */
export interface BodyIndex {
  byId: ReadonlyMap<string, CelestialBodyData>;
  /** Children of a parent id, in ascending real-distance order. */
  childrenOf: ReadonlyMap<string, ReadonlyArray<CelestialBodyData>>;
  /** Ordered top-level bodies (the star and its direct planets/pluto). */
  roots: ReadonlyArray<CelestialBodyData>;
}

/** Rendered (display) metrics of a body, strictly separated from real data. */
export interface RenderedMetrics {
  /** Rendered orbital distance from parent, in scene units. */
  renderedDistance: number;
  /** Rendered body radius, in scene units. */
  renderedRadius: number;
}

/** Snapshot handed to the UI when a body is selected or hovered. */
export interface BodySelectionView {
  data: CelestialBodyData;
  metrics: RenderedMetrics;
  /** Active distance representation at selection time. */
  distanceMode: DistanceMode;
  /** Active size representation at selection time. */
  sizeMode: SizeMode;
}

/** Application-level settings that are shared/observed across modules. */
export interface AppSettings {
  distanceMode: DistanceMode;
  sizeMode: SizeMode;
  viewMode: ViewMode;
  playing: boolean;
  timeScaleDaysPerSecond: number;
  showOrbits: boolean;
  showLabels: boolean;
  showMoons: boolean;
  showStarfield: boolean;
  uiHidden: boolean;
}

/**
 * A body placed in a scene as a THREE group, exposing the minimal API render
 * modules and the ray selector rely on. Implementations live in core/.
 */
export interface SceneBodyHandle {
  readonly id: string;
  readonly data: CelestialBodyData;
  readonly sceneGroup: import("three").Group;
  /** Local scene-space orbit radius currently applied (for ray-calcs/debug). */
  renderDistance: number;
  renderRadius: number;
  setVisible(visible: boolean): void;
  setOrbitVisible(visible: boolean): void;
  update(timeDays: number): void;
  dispose(): void;
}
