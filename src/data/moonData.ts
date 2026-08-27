/**
 * Major-moon dataset — isolated in its own file so moons can be added or
 * removed (or their values tuned) WITHOUT touching the rendering engine.
 *
 * Values are compacted NASA/JPL fact-sheet figures (approximate, not
 * over-precise). Distances are semi-major axes in km from the parent's centre;
 * periods are sidereal orbital days (negative = retrograde for Triton).
 * Radius is the mean radius in km.
 */
import type { CelestialBodyData } from "../types";

/** Citation for all real values below (NASA Planetary Fact Sheets, via JPL). */
const SOURCE_NASA_FACT_SHEET =
  "NASA Planetary Fact Sheets — https://nssdc.gsfc.nasa.gov/planetary/factsheet/";

type MoonSeed = {
  id: string;
  nameKo: string;
  nameEn: string;
  radiusKm: number;
  distKm: number;
  periodDays: number;
  eccentricity?: number;
  inclinationDeg?: number;
  color: string;
};

const MOON_SEEDS: ReadonlyArray<MoonSeed> = [
  // Earth
  { id: "moon.earth.luna", nameKo: "달", nameEn: "Moon", radiusKm: 1737.4, distKm: 384400, periodDays: 27.32, eccentricity: 0.0549, inclinationDeg: 5.14, color: "#c7c7c7" },
  // Mars
  { id: "moon.mars.phobos", nameKo: "포보스", nameEn: "Phobos", radiusKm: 11.1, distKm: 9376, periodDays: 0.319, color: "#a1846a" },
  { id: "moon.mars.deimos", nameKo: "데이모스", nameEn: "Deimos", radiusKm: 6.2, distKm: 23463, periodDays: 1.263, color: "#b6a091" },
  // Jupiter
  { id: "moon.jupiter.io", nameKo: "이오", nameEn: "Io", radiusKm: 1821.6, distKm: 421700, periodDays: 1.769, eccentricity: 0.0041, color: "#d9c86a" },
  { id: "moon.jupiter.europa", nameKo: "유로파", nameEn: "Europa", radiusKm: 1560.8, distKm: 671034, periodDays: 3.551, eccentricity: 0.009, color: "#cbb9a0" },
  { id: "moon.jupiter.ganymede", nameKo: "가니메데", nameEn: "Ganymede", radiusKm: 2634.1, distKm: 1070412, periodDays: 7.155, eccentricity: 0.0013, color: "#ab9a86" },
  { id: "moon.jupiter.callisto", nameKo: "칼리스토", nameEn: "Callisto", radiusKm: 2410.3, distKm: 1882709, periodDays: 16.69, eccentricity: 0.007, color: "#9a8f82" },
  // Saturn
  { id: "moon.saturn.mimas", nameKo: "미마스", nameEn: "Mimas", radiusKm: 198.2, distKm: 185539, periodDays: 0.942, eccentricity: 0.0196, color: "#c3c2bd" },
  { id: "moon.saturn.enceladus", nameKo: "엔셀라두스", nameEn: "Enceladus", radiusKm: 252.1, distKm: 237948, periodDays: 1.370, eccentricity: 0.0047, color: "#d6d2c9" },
  { id: "moon.saturn.tethys", nameKo: "테티스", nameEn: "Tethys", radiusKm: 531.1, distKm: 294619, periodDays: 1.888, eccentricity: 0.0001, color: "#c9bfae" },
  { id: "moon.saturn.dione", nameKo: "디오네", nameEn: "Dione", radiusKm: 561.4, distKm: 377396, periodDays: 2.737, eccentricity: 0.0022, color: "#c4bda9" },
  { id: "moon.saturn.rhea", nameKo: "레아", nameEn: "Rhea", radiusKm: 763.8, distKm: 527108, periodDays: 4.518, eccentricity: 0.001, color: "#bfb9a6" },
  { id: "moon.saturn.titan", nameKo: "타이탄", nameEn: "Titan", radiusKm: 2574.7, distKm: 1221870, periodDays: 15.95, eccentricity: 0.0288, color: "#d0a54f" },
  { id: "moon.saturn.iapetus", nameKo: "이아페투스", nameEn: "Iapetus", radiusKm: 734.5, distKm: 3560820, periodDays: 79.32, eccentricity: 0.0286, color: "#9c8f7a" },
  // Uranus
  { id: "moon.uranus.miranda", nameKo: "미란다", nameEn: "Miranda", radiusKm: 235.8, distKm: 129390, periodDays: 1.413, color: "#a49aa6" },
  { id: "moon.uranus.ariel", nameKo: "아리엘", nameEn: "Ariel", radiusKm: 578.9, distKm: 190900, periodDays: 2.520, color: "#b8b0c2" },
  { id: "moon.uranus.umbriel", nameKo: "움브리엘", nameEn: "Umbriel", radiusKm: 584.7, distKm: 266000, periodDays: 4.144, color: "#8f8b99" },
  { id: "moon.uranus.titania", nameKo: "티타니아", nameEn: "Titania", radiusKm: 788.9, distKm: 436300, periodDays: 8.706, color: "#b3aab8" },
  { id: "moon.uranus.oberon", nameKo: "오베론", nameEn: "Oberon", radiusKm: 761.4, distKm: 583500, periodDays: 13.46, color: "#9891a0" },
  // Neptune
  { id: "moon.neptune.triton", nameKo: "트리톤", nameEn: "Triton", radiusKm: 1353.4, distKm: 354759, periodDays: -5.877, eccentricity: 0.000016, inclinationDeg: 156.88, color: "#c9c8cf" },
  // Pluto
  { id: "moon.pluto.charon", nameKo: "카론", nameEn: "Charon", radiusKm: 606.0, distKm: 19591, periodDays: 6.387, eccentricity: 0.000, color: "#b7a9a0" },
  { id: "moon.pluto.styx", nameKo: "스틱스", nameEn: "Styx", radiusKm: 5.0, distKm: 42656, periodDays: 20.16, color: "#9a948f" },
  { id: "moon.pluto.nix", nameKo: "닉스", nameEn: "Nix", radiusKm: 23.0, distKm: 48694, periodDays: 24.85, color: "#a5a09b" },
  { id: "moon.pluto.kerberos", nameKo: "케르베로스", nameEn: "Kerberos", radiusKm: 14.0, distKm: 57783, periodDays: 32.17, color: "#8f8a86" },
  { id: "moon.pluto.hydra", nameKo: "히드라", nameEn: "Hydra", radiusKm: 30.8, distKm: 64738, periodDays: 38.20, color: "#a29c97" },
];

/** Full moon records, typed and frozen. */
export const MAJOR_MOONS: ReadonlyArray<CelestialBodyData> = MOON_SEEDS.map(
  (seed): CelestialBodyData =>
    Object.freeze({
      id: seed.id,
      nameKo: seed.nameKo,
      nameEn: seed.nameEn,
      type: "moon",
      parentId: parentIdOf(seed.id),
      radiusKm: seed.radiusKm,
      semiMajorAxis: seed.distKm,
      semiMajorAxisUnit: "km",
      eccentricity: seed.eccentricity ?? 0,
      inclinationDeg: seed.inclinationDeg ?? 0,
      orbitalPeriodDays: Math.abs(seed.periodDays),
      displayColor: seed.color,
      source: SOURCE_NASA_FACT_SHEET,
    }),
);

function parentIdOf(moonId: string): string {
  // moon.<parentKey>.<name> -> planet.<parentKey>
  const key = moonId.split(".")[1];
  return `planet.${key}`;
}
