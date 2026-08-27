/**
 * UI language support (ko / en).
 *
 * This is the single place that owns the current locale and the ko/en display
 * dictionary. Every user-facing string in the demo (header, HUD, control panel,
 * info panel, tooltip, scene labels, scale-mode guidance, disclaimer) is looked
 * up here so a toggle flips the whole UI at once with no reload.
 *
 * Missing keys never produce a literal "undefined": `t()` falls back to the
 * Korean teamplate first and then to the key itself.
 *
 * Celestial body names are NOT duplicated here — the data already carries
 * `nameKo`/`nameEn` per body (see types.ts / solarSystemData.ts / moonData.ts).
 * `bodyName()` / `otherBodyName()` select the right field for the active locale,
 * which keeps the existing data structure as the single source of truth.
 */
export type Locale = "ko" | "en";

/** ``{n}`` placeholders are substituted by the template helpers below. */
const ko: Record<string, string> = {
  // Header
  "header.title": "로그 스케일 태양계",
  "header.subtitle": "실제 천문 데이터를 로그 스케일로 압축해 시각화한 3D 태양계 데모",

  // Language toggle aria
  "lang.toEn": "영어로 전환",
  "lang.toKo": "한국어로 전환",

  // UI hide toggle (always-accessible fixed button)
  "ui.hide": "UI 숨김 (H)",
  "ui.show": "UI 보기 (H)",

  // Control panel
  "ctrl.title": "컨트롤",
  "ctrl.play": "재생",
  "ctrl.pause": "일시정지",
  "ctrl.reset": "리셋",
  "ctrl.fullView": "전체뷰",
  "ctrl.back": "← 뒤로",
  "ctrl.timeScale": "시간배율",
  "ctrl.time.year": "1초 = 1년",
  "ctrl.time.days": "1초 = {n}일",
  "ctrl.sim": "시뮬레이션",
  "ctrl.elapsed": "경과 {n}일",
  "ctrl.distance": "거리 스케일",
  "ctrl.size": "크기 스케일",
  "ctrl.orbits": "궤도",
  "ctrl.labels": "라벨",
  "ctrl.moons": "위성",
  "ctrl.starfield": "별필드",

  // Distance / size mode labels
  "mode.log": "로그 스케일 (기본)",
  "mode.linear": "선형 스케일",
  "mode.focus": "포커스 스케일",
  "mode.enhanced": "확대 가시성 (기본)",
  "mode.relative": "상대 크기",
  "mode.uniform": "균일 마커",

  // Body type labels
  "type.star": "별",
  "type.planet": "행성",
  "type.dwarf-planet": "왜행성",
  "type.moon": "위성",

  // Info panel
  "info.real": "실제 데이터 (천문)",
  "info.rendered": "렌더 값 (표시)",
  "info.type": "유형",
  "info.actualRadius": "실제 반지름",
  "info.meanDist": "평균 거리",
  "info.center": "— (중심)",
  "info.moonDist": "모행성 평균 거리",
  "info.sunDist": "태양 평균 거리",
  "info.orbitPeriod": "공전 주기",
  "info.rotPeriod": "자전 주기",
  "info.eccentricity": "이심률",
  "info.inclination": "궤도 경사",
  "info.renderDistance": "렌더 거리",
  "info.distanceMode": "거리 표현",
  "info.renderRadius": "렌더 반지름",
  "info.sizeMode": "크기 표현",
  "info.childrenPlanets": "구성 행성",
  "info.childrenMoons": "위성 목록",
  "info.noMoons": "위성 없음",

  // Units
  "unit.days": "일",
  "unit.hours": "시간",
  "unit.km": "km",
  "unit.au": "AU",
  "unit.units": "units",
  "unit.na": "—",

  // Scale disclaimer (required notice)
  disclaimer:
    "실제 천문 데이터를 사용하되, 궤도 거리는 로그 스케일(Log Scale)로 압축하고 " +
    "천체 크기는 가시성을 위해 확대했습니다. 즉 크기는 물리적 배율과 무관합니다.",
};

const en: Record<string, string> = {
  "header.title": "Logarithmic Solar System",
  "header.subtitle":
    "A 3D solar system demo visualizing real astronomical data compressed with logarithmic scaling",

  "lang.toEn": "Switch to English",
  "lang.toKo": "Switch to Korean",

  "ui.hide": "Hide UI (H)",
  "ui.show": "Show UI (H)",

  "ctrl.title": "Controls",
  "ctrl.play": "Play",
  "ctrl.pause": "Pause",
  "ctrl.reset": "Reset",
  "ctrl.fullView": "Full View",
  "ctrl.back": "← Back",
  "ctrl.timeScale": "Time Scale",
  "ctrl.time.year": "1s = 1 year",
  "ctrl.time.days": "1s = {n} days",
  "ctrl.sim": "Simulation",
  "ctrl.elapsed": "{n} days elapsed",
  "ctrl.distance": "Distance Scale",
  "ctrl.size": "Size Scale",
  "ctrl.orbits": "Orbits",
  "ctrl.labels": "Labels",
  "ctrl.moons": "Moons",
  "ctrl.starfield": "Starfield",

  "mode.log": "Log Scale (default)",
  "mode.linear": "Linear Scale",
  "mode.focus": "Focus Scale",
  "mode.enhanced": "Enhanced Visibility (default)",
  "mode.relative": "Relative Size",
  "mode.uniform": "Uniform Markers",

  "type.star": "Star",
  "type.planet": "Planet",
  "type.dwarf-planet": "Dwarf Planet",
  "type.moon": "Moon",

  "info.real": "Real Data (Astronomical)",
  "info.rendered": "Rendered Values (Display)",
  "info.type": "Type",
  "info.actualRadius": "Actual Radius",
  "info.meanDist": "Mean Distance",
  "info.center": "— (center)",
  "info.moonDist": "Mean Distance from Parent",
  "info.sunDist": "Mean Distance from Sun",
  "info.orbitPeriod": "Orbital Period",
  "info.rotPeriod": "Rotation Period",
  "info.eccentricity": "Eccentricity",
  "info.inclination": "Orbital Inclination",
  "info.renderDistance": "Rendered Distance",
  "info.distanceMode": "Distance Mode",
  "info.renderRadius": "Rendered Radius",
  "info.sizeMode": "Size Mode",
  "info.childrenPlanets": "Orbiting Planets",
  "info.childrenMoons": "Moons",
  "info.noMoons": "No moons",

  "unit.days": "days",
  "unit.hours": "hrs",
  "unit.km": "km",
  "unit.au": "AU",
  "unit.units": "units",
  "unit.na": "—",

  disclaimer:
    "Real data, but orbital distance uses a logarithmic scale and body sizes are " +
    "visually enlarged — rendered size is unrelated to physical scale.",
};

/** BCP-47 locale tag used for number formatting. */
export function numberLocale(): string {
  return currentLocale === "en" ? "en-US" : "ko-KR";
}

let currentLocale: Locale = "ko";
const listeners = new Set<(locale: Locale) => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (locale !== "ko" && locale !== "en") return;
  if (locale === currentLocale) return;
  currentLocale = locale;
  document.documentElement.lang = locale;
  for (const fn of listeners) fn(locale);
}

/** Flip between ko/en; returns the newly active locale. */
export function toggleLocale(): Locale {
  setLocale(currentLocale === "ko" ? "en" : "ko");
  return currentLocale;
}

/** Subscribe to locale changes; returns an unsubscribe function. */
export function onLocaleChange(fn: (locale: Locale) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Current-locale string for `key` (never yields a literal "undefined"). */
export function t(key: string): string {
  const table = currentLocale === "en" ? en : ko;
  const value = table[key];
  if (value !== undefined) return value;
  const fallback = ko[key];
  return fallback !== undefined ? fallback : key;
}

/**
 * Current-locale string with ``{name}`` placeholders substituted, e.g.
 * `tpl("ctrl.elapsed", { n: "1,024" })`.
 */
export function tpl(key: string, vars: Record<string, string | number>): string {
  let s = t(key);
  for (const [name, value] of Object.entries(vars)) {
    s = s.split(`{${name}}`).join(String(value));
  }
  return s;
}

/** Active-locale display name of a celestial body (data holds both fields). */
export function bodyName(data: { nameKo: string; nameEn: string }): string {
  return currentLocale === "en" ? data.nameEn : data.nameKo;
}

/** The body name in the non-active locale (kept as a muted secondary line). */
export function otherBodyName(data: { nameKo: string; nameEn: string }): string {
  return currentLocale === "en" ? data.nameKo : data.nameEn;
}

/**
 * Dictionary-integrity check used by the verification harness: every key that
 * exists in either locale must exist in both, and no key may ever resolve to a
 * literal "undefined" string (which the UI would otherwise flash on screen).
 */
export function i18nIntegrityCheck(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const allKeys = new Set<string>([...Object.keys(ko), ...Object.keys(en)]);
  for (const key of allKeys) {
    if (!(key in ko) || !(key in en)) missing.push(`${key} (missing in one locale)`);
    // `t` never yields a literal "undefined": it falls back to ko, then the key.
    const value = t(key);
    if (value === undefined || value.toLowerCase() === "undefined") {
      missing.push(`${key} -> undefined`);
    }
  }
  return { ok: missing.length === 0, missing };
}
