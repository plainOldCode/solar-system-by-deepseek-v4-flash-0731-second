/**
 * Self-contained verification harness for (a) the celestial dataset and (b) the
 * pure scale-mapping functions. It is framework-agnostic: it runs under Node
 * via scripts/verify.mjs, which boots Vite's SSR module runner so this module's
 * extensionless TypeScript imports resolve exactly as they do in the browser
 * build — no extra test framework is required.
 *
 * It auto-verifies boundary values, monotonicity, NaN/infinity prevention,
 * order preservation (distance & size), the Enhanced-size guarantee
 * (Jupiter/Saturn clearly larger than Earth) and required-body/moon presence.
 */
import { ScaleManager } from "./core/ScaleManager";
import {
  MAX_DISTANCE_AU,
  MAX_RENDER_DISTANCE,
  MIN_RENDER_DISTANCE,
  MOON_RENDER_MAX_MULTIPLE,
  MOON_RENDER_MIN_MULTIPLE,
  PLANET_RADIUS_MAX,
  PLANET_RADIUS_MIN,
} from "./config/constants";
import { buildBodyIndex } from "./data/solarSystemData";
import type { DistanceMode, SizeMode } from "./types";
import { i18nIntegrityCheck } from "./ui/i18n";

export interface VerifyCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

const checks: VerifyCheck[] = [];

function check(name: string, ok: boolean, detail?: string): void {
  checks.push({ name, ok: !!ok, detail: ok ? undefined : detail });
}

function isFiniteNumber(v: number): boolean {
  return typeof v === "number" && Number.isFinite(v);
}

function near(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}

/* ------------------------------------------------------------------ *
 * Required celestial bodies / moons that must all exist in the index.
 * ------------------------------------------------------------------ */
const REQUIRED_IDS = [
  "star.sun",
  "planet.mercury",
  "planet.venus",
  "planet.earth",
  "planet.mars",
  "planet.jupiter",
  "planet.saturn",
  "planet.uranus",
  "planet.neptune",
  "planet.pluto",
  "moon.earth.luna",
  "moon.mars.phobos",
  "moon.mars.deimos",
  "moon.jupiter.io",
  "moon.jupiter.europa",
  "moon.jupiter.ganymede",
  "moon.jupiter.callisto",
  "moon.saturn.mimas",
  "moon.saturn.enceladus",
  "moon.saturn.tethys",
  "moon.saturn.dione",
  "moon.saturn.rhea",
  "moon.saturn.titan",
  "moon.saturn.iapetus",
  "moon.uranus.miranda",
  "moon.uranus.ariel",
  "moon.uranus.umbriel",
  "moon.uranus.titania",
  "moon.uranus.oberon",
  "moon.neptune.triton",
  "moon.pluto.charon",
  "moon.pluto.styx",
  "moon.pluto.nix",
  "moon.pluto.kerberos",
  "moon.pluto.hydra",
];

// Expected direct children, keyed by parent id.
const EXPECTED_CHILDREN: Record<string, string[]> = {
  "planet.earth": ["moon.earth.luna"],
  "planet.mars": ["moon.mars.phobos", "moon.mars.deimos"],
  "planet.jupiter": [
    "moon.jupiter.io",
    "moon.jupiter.europa",
    "moon.jupiter.ganymede",
    "moon.jupiter.callisto",
  ],
  "planet.saturn": [
    "moon.saturn.mimas",
    "moon.saturn.enceladus",
    "moon.saturn.tethys",
    "moon.saturn.dione",
    "moon.saturn.rhea",
    "moon.saturn.titan",
    "moon.saturn.iapetus",
  ],
  "planet.uranus": [
    "moon.uranus.miranda",
    "moon.uranus.ariel",
    "moon.uranus.umbriel",
    "moon.uranus.titania",
    "moon.uranus.oberon",
  ],
  "planet.neptune": ["moon.neptune.triton"],
  "planet.pluto": [
    "moon.pluto.charon",
    "moon.pluto.styx",
    "moon.pluto.nix",
    "moon.pluto.kerberos",
    "moon.pluto.hydra",
  ],
};

export interface VerifyResult {
  total: number;
  failures: number;
  checks: VerifyCheck[];
}

export function runVerification(): VerifyResult {
  checks.length = 0;
  const scale = new ScaleManager();
  const index = buildBodyIndex();

  /* ---- 1. dataset integrity ---- */
  const missing = REQUIRED_IDS.filter((id) => !index.byId.has(id));
  check(
    "all required bodies & major moons present",
    missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : undefined,
  );

  const childIssues: string[] = [];
  for (const [parent, childIds] of Object.entries(EXPECTED_CHILDREN)) {
    const children = (index.childrenOf.get(parent) ?? []).map((c) => c.id);
    for (const childId of childIds) {
      if (!children.includes(childId)) childIssues.push(`${parent} lacks ${childId}`);
    }
  }
  check("expected moon sets under correct parents", childIssues.length === 0, childIssues.join("; ") || undefined);

  const axisOrderOk = Array.from(index.childrenOf.entries()).every(([, children]) =>
    children.every((b, i) => i === 0 || (b.semiMajorAxis ?? 0) >= (children[i - 1].semiMajorAxis ?? 0)),
  );
  check("children sorted by ascending real semi-major axis", axisOrderOk);

  const noSource = Array.from(index.byId.values()).filter(
    (b) => typeof b.source !== "string" || b.source.trim().length === 0,
  );
  check("every body carries non-empty source metadata", noSource.length === 0, noSource.map((b) => b.id).join(", ") || undefined);

  const badValues: string[] = [];
  let plutoEcc = 0;
  let plutoInc = 0;
  for (const body of index.byId.values()) {
    if (!isFiniteNumber(body.radiusKm) || body.radiusKm <= 0) badValues.push(`${body.id}.radius`);
    if (body.semiMajorAxis !== undefined && (!isFiniteNumber(body.semiMajorAxis) || body.semiMajorAxis <= 0)) {
      badValues.push(`${body.id}.semiMajorAxis`);
    }
    if (body.id === "planet.pluto") {
      plutoEcc = body.eccentricity ?? 0;
      plutoInc = body.inclinationDeg ?? 0;
    }
  }
  check("all real values finite & positive where required", badValues.length === 0, badValues.join(", ") || undefined);
  check("Pluto keeps high eccentricity (>0.2)", plutoEcc > 0.2, `got ${plutoEcc}`);
  check("Pluto keeps high inclination (>10deg)", plutoInc > 10, `got ${plutoInc}`);

  /* ---- 2. heliocentric distance ---- */
  const auSamples = [0.05, 0.1, 0.387, 0.723, 1.0, 1.524, 5.2, 9.5, 19.2, 30.1, 39.5];
  const modesH: DistanceMode[] = ["log", "linear", "focus"];
  scale.setFocusDistanceAU(5.2);

  const nanH = auSamples.filter((au) => modesH.some((m) => !isFiniteNumber(scale.mapHeliocentricDistance(au, m))));
  check("heliocentric map finite (no NaN) in all modes", nanH.length === 0, nanH.length ? `at AU ${nanH.join(",")}` : undefined);

  check("heliocentric bounds: 0 & MAX_DISTANCE_AU hit render range (log)", 
    near(scale.mapHeliocentricDistance(0, "log"), MIN_RENDER_DISTANCE) &&
    near(scale.mapHeliocentricDistance(MAX_DISTANCE_AU, "log"), MAX_RENDER_DISTANCE));
  check("heliocentric bounds: 0 & MAX_DISTANCE_AU hit render range (linear)",
    near(scale.mapHeliocentricDistance(0, "linear"), MIN_RENDER_DISTANCE) &&
    near(scale.mapHeliocentricDistance(MAX_DISTANCE_AU, "linear"), MAX_RENDER_DISTANCE));

  const rangeOk = (["log", "linear"] as const).every((m) =>
    auSamples.every((au) => {
      const r = scale.mapHeliocentricDistance(au, m);
      return r >= MIN_RENDER_DISTANCE && r <= MAX_RENDER_DISTANCE;
    }),
  );
  check("heliocentric render values inside range (log & linear)", rangeOk);

  const orderOk = (["log", "linear"] as const).every((m) =>
    auSamples.every((au, i) => i === 0 || scale.mapHeliocentricDistance(au, m) > scale.mapHeliocentricDistance(auSamples[i - 1], m)),
  );
  check("Sun..Pluto distance ORDER preserved (log & linear)", orderOk);

  const inner = [0.387, 0.723, 1.0, 1.524].map((au) => scale.mapHeliocentricDistance(au, "log"));
  // Inner planets must stay visibly separated in the default log view. The
  // tightest real gap is Venus→Earth (0.277 AU); require each rendered gap to
  // be at least ~2% of the full render range (≈3.5 units) so no pair collapses.
  const innerGapsOk = inner.every((v, i) => i === 0 || v - inner[i - 1] > (MAX_RENDER_DISTANCE - MIN_RENDER_DISTANCE) * 0.02);
  check(
    "inner planets distinguishable in default log view",
    innerGapsOk,
    inner.map((v) => v.toFixed(1)).join(" -> "),
  );

  const outers = [5.204, 9.537, 19.19, 30.07, 39.48].map((au) => scale.mapHeliocentricDistance(au, "log"));
  const outerSpan = outers[outers.length - 1] - outers[0];
  check("outer planets do not clump in default log view", outerSpan > (MAX_RENDER_DISTANCE - MIN_RENDER_DISTANCE) * 0.3, `span ${outerSpan.toFixed(1)}`);

  /* ---- 3. satellite distance ---- */
  check(
    "satellite map boundary = 2.5x parent radius",
    near(scale.mapSatelliteDistance(1000, 1000, 10000), MOON_RENDER_MIN_MULTIPLE),
  );
  check(
    "satellite map boundary = 9x parent radius",
    near(scale.mapSatelliteDistance(10000, 1000, 10000), MOON_RENDER_MAX_MULTIPLE),
  );
  let satPrev = -Infinity;
  const satOk = (() => {
    for (let d = 1; d <= 100000; d *= 1.7) {
      const r = scale.mapSatelliteDistance(d, 1, 100000);
      if (!isFiniteNumber(r) || r < satPrev) return false;
      satPrev = r;
    }
    return true;
  })();
  check("satellite map monotonic & finite", satOk);

  /* ---- 4. body size ---- */
  const planetRadii = [
    { id: "pluto", km: 1188.3 },
    { id: "mercury", km: 2439.7 },
    { id: "mars", km: 3389.5 },
    { id: "venus", km: 6051.8 },
    { id: "earth", km: 6371.0 },
    { id: "neptune", km: 24622 },
    { id: "uranus", km: 25362 },
    { id: "saturn", km: 58232 },
    { id: "jupiter", km: 69911 },
  ];
  const modesS: SizeMode[] = ["enhanced", "relative", "uniform"];

  const sizeFiniteOk = modesS.every((mode) =>
    planetRadii.every((p) => isFiniteNumber(scale.mapPlanetRadius(p.km, mode)) && isFiniteNumber(scale.mapMoonRadius(p.km, mode))),
  );
  check("size maps finite in every mode", sizeFiniteOk);

  const sizeOrderOk = modesS.every((mode) =>
    planetRadii.every((p, i) => i === 0 || scale.mapPlanetRadius(p.km, mode) >= scale.mapPlanetRadius(planetRadii[i - 1].km, mode)),
  );
  check("celestial-body SIZE order preserved in every mode", sizeOrderOk);

  const jup = scale.mapPlanetRadius(69911, "enhanced");
  const sat = scale.mapPlanetRadius(58232, "enhanced");
  const earthR = scale.mapPlanetRadius(6371, "enhanced");
  check("Enhanced: Jupiter clearly larger than Earth", jup > earthR * 1.8, `jupiter=${jup.toFixed(3)} earth=${earthR.toFixed(3)}`);
  check("Enhanced: Saturn clearly larger than Earth", sat > earthR * 1.8, `saturn=${sat.toFixed(3)} earth=${earthR.toFixed(3)}`);
  check("Enhanced: giant planets not saturated to max", jup < PLANET_RADIUS_MAX && sat < PLANET_RADIUS_MAX && jup !== earthR);

  const innerPlanetsBelowEarth = [6051.8, 3389.5, 2439.7, 1188.3].every(
    (km) => scale.mapPlanetRadius(km, "enhanced") < earthR,
  );
  check("Enhanced: Earth above Venus/Mars/Mercury/Pluto", innerPlanetsBelowEarth);
  check("Enhanced: Earth inside planet render floor/ceiling", earthR >= PLANET_RADIUS_MIN);

  const moonR = scale.mapMoonRadius(1737.4, "enhanced");
  check("moon radius finite & positive (Enhanced)", isFiniteNumber(moonR) && moonR > 0, moonR === undefined ? "NaN" : undefined);

  /* ---- 5. i18n dictionary integrity ---- */
  const i18n = i18nIntegrityCheck();
  check(
    "ko/en dictionaries complete & never resolve to undefined",
    i18n.ok,
    i18n.missing.length ? i18n.missing.join("; ") : undefined,
  );

  return { total: checks.length, failures: checks.filter((c) => !c.ok).length, checks };
}
