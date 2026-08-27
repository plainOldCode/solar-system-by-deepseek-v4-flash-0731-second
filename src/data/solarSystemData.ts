/**
 * Solar system (star + eight planets + dwarf planet Pluto) dataset and the
 * body-index builder that merges in the major moons.
 *
 * All values are compacted NASA/JPL fact-sheet figures (approximate). Real
 * values are kept here and in moonData.ts; rendering dwarves live in core/.
 */
import type { BodyIndex, CelestialBodyData, LengthUnit } from "../types";
import { MAJOR_MOONS } from "./moonData";

/** Citation for all real values below (NASA Planetary Fact Sheets, via JPL). */
const SOURCE_NASA_FACT_SHEET =
  "NASA Planetary Fact Sheets — https://nssdc.gsfc.nasa.gov/planetary/factsheet/";

type PlanetSeed = {
  id: string;
  nameKo: string;
  nameEn: string;
  type: CelestialBodyData["type"];
  radiusKm: number;
  sma: number;
  unit: LengthUnit;
  ecc: number;
  inc: number;
  periodDays: number;
  rotHours: number;
  tiltDeg: number;
  color: string;
  rings?: { innerKm: number; outerKm: number };
};

const PLANET_SEEDS: ReadonlyArray<PlanetSeed> = [
  { id: "planet.mercury", nameKo: "수성", nameEn: "Mercury", type: "planet", radiusKm: 2439.7, sma: 0.387, unit: "AU", ecc: 0.2056, inc: 7.0, periodDays: 87.97, rotHours: 1407.6, tiltDeg: 0.03, color: "#a19a95" },
  { id: "planet.venus", nameKo: "금성", nameEn: "Venus", type: "planet", radiusKm: 6051.8, sma: 0.723, unit: "AU", ecc: 0.0068, inc: 3.39, periodDays: 224.7, rotHours: -5832.5, tiltDeg: 177.4, color: "#d9b66b" },
  { id: "planet.earth", nameKo: "지구", nameEn: "Earth", type: "planet", radiusKm: 6371.0, sma: 1.0, unit: "AU", ecc: 0.0167, inc: 0.0, periodDays: 365.25, rotHours: 23.93, tiltDeg: 23.44, color: "#3a6fc4" },
  { id: "planet.mars", nameKo: "화성", nameEn: "Mars", type: "planet", radiusKm: 3389.5, sma: 1.524, unit: "AU", ecc: 0.0934, inc: 1.85, periodDays: 686.98, rotHours: 24.62, tiltDeg: 25.19, color: "#c1440e" },
  { id: "planet.jupiter", nameKo: "목성", nameEn: "Jupiter", type: "planet", radiusKm: 69911, sma: 5.204, unit: "AU", ecc: 0.0489, inc: 1.3, periodDays: 4332.6, rotHours: 9.93, tiltDeg: 3.13, color: "#c9a277" },
  { id: "planet.saturn", nameKo: "토성", nameEn: "Saturn", type: "planet", radiusKm: 58232, sma: 9.537, unit: "AU", ecc: 0.0565, inc: 2.49, periodDays: 10759, rotHours: 10.66, tiltDeg: 26.73, color: "#e0c98a", rings: { innerKm: 74658, outerKm: 140180 } },
  { id: "planet.uranus", nameKo: "천왕성", nameEn: "Uranus", type: "planet", radiusKm: 25362, sma: 19.19, unit: "AU", ecc: 0.0457, inc: 0.77, periodDays: 30687, rotHours: -17.24, tiltDeg: 97.77, color: "#6fd0d8", rings: { innerKm: 38000, outerKm: 98000 } },
  { id: "planet.neptune", nameKo: "해왕성", nameEn: "Neptune", type: "planet", radiusKm: 24622, sma: 30.07, unit: "AU", ecc: 0.0113, inc: 1.77, periodDays: 60190, rotHours: 16.11, tiltDeg: 28.32, color: "#3b5bd6" },
  { id: "planet.pluto", nameKo: "명왕성", nameEn: "Pluto", type: "dwarf-planet", radiusKm: 1188.3, sma: 39.48, unit: "AU", ecc: 0.2488, inc: 17.16, periodDays: 90560, rotHours: -153.29, tiltDeg: 122.5, color: "#b39f8c" },
];

/** The star. */
export const SUN: CelestialBodyData = Object.freeze({
  id: "star.sun",
  nameKo: "태양",
  nameEn: "Sun",
  type: "star",
  radiusKm: 696340,
  displayColor: "#f9d71c",
  description: "G-type main-sequence star at the centre of the Solar System.",
  source: SOURCE_NASA_FACT_SHEET,
});

/** Planets plus dwarf planet Pluto, typed and frozen. */
export const PLANETS: ReadonlyArray<CelestialBodyData> = PLANET_SEEDS.map(
  (seed): CelestialBodyData =>
    Object.freeze({
      id: seed.id,
      nameKo: seed.nameKo,
      nameEn: seed.nameEn,
      type: seed.type,
      parentId: SUN.id,
      radiusKm: seed.radiusKm,
      semiMajorAxis: seed.sma,
      semiMajorAxisUnit: seed.unit,
      eccentricity: seed.ecc,
      inclinationDeg: seed.inc,
      orbitalPeriodDays: seed.periodDays,
      rotationPeriodHours: seed.rotHours,
      axialTiltDeg: seed.tiltDeg,
      displayColor: seed.color,
      hasRings: seed.rings !== undefined,
      ringInnerKm: seed.rings?.innerKm,
      ringOuterKm: seed.rings?.outerKm,
      source: SOURCE_NASA_FACT_SHEET,
    }),
);

/**
 * Merge star + planets + moons into a BodyIndex that render and UI modules
 * query: O(1) lookup by id, ordered children per parent, ordered roots.
 */
export function buildBodyIndex(): BodyIndex {
  const all: ReadonlyArray<CelestialBodyData> = [SUN, ...PLANETS, ...MAJOR_MOONS];

  const byId = new Map<string, CelestialBodyData>();
  const childrenOf = new Map<string, CelestialBodyData[]>();

  for (const body of all) {
    byId.set(body.id, body);
    const parent = body.parentId;
    if (parent !== undefined) {
      const list = childrenOf.get(parent) ?? [];
      list.push(body);
      childrenOf.set(parent, list);
    }
  }

  // Each child list is sorted by ascending real semi-major axis.
  for (const [parent, list] of childrenOf) {
    list.sort((a, b) => axisOf(a) - axisOf(b));
    childrenOf.set(parent, list);
  }

  return {
    byId,
    childrenOf,
    roots: PLANETS,
  };
}

function axisOf(body: CelestialBodyData): number {
  return body.semiMajorAxis ?? 0;
}
