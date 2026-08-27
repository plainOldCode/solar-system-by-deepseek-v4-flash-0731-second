/**
 * Information panel: shows the selected body's REAL astronomical values and the
 * CURRENT RENDERED values, explicitly separated with their active scales, plus
 * the moon/children list. Values update on selection, scale changes and locale
 * changes (the EN/한글 toggle re-renders the whole panel in place).
 */
import type { BodyIndex, RenderedMetrics } from "../types";
import type { StateStore } from "../core/StateStore";
import { DISTANCE_MODES, SIZE_MODES } from "../config/constants";
import { clear, el } from "./dom";
import {
  bodyName,
  numberLocale,
  onLocaleChange,
  otherBodyName,
  t,
} from "./i18n";

export class InfoPanel {
  private readonly root: HTMLElement;
  private selectedId: string | null = null;

  constructor(
    private readonly index: BodyIndex,
    store: StateStore,
    getRender: (bodyId: string) => RenderedMetrics | undefined,
  ) {
    this.root = document.querySelector("#info-panel") as HTMLElement;

    const render = (): void => {
      const settings = store.getSettings();
      const selected = this.selectedId;
      if (!selected) {
        this.root.hidden = true;
        return;
      }
      this.renderBody(selected, settings.distanceMode, settings.sizeMode, getRender);
    };

    store.on("select", ({ id }) => {
      this.selectedId = id;
      render();
    });
    store.on("settings", render); // scale modes can change rendered values
    onLocaleChange(render); // language flip re-renders in place
  }

  private renderBody(
    id: string,
    distanceMode: string,
    sizeMode: string,
    getRender: (bodyId: string) => RenderedMetrics | undefined,
  ): void {
    const data = this.index.byId.get(id);
    if (!data) {
      this.root.hidden = true;
      return;
    }
    const children = this.index.childrenOf.get(id) ?? [];

    this.root.hidden = false;
    clear(this.root);

    // Title: active-locale name prominent, other-locale name as a muted line.
    const title = el("div", "panel-title");
    title.append(
      el("div", "title-ko", bodyName(data)),
      el("div", "title-en", otherBodyName(data)),
    );
    this.root.append(title);

    const ref = this.actualReference(data);

    // --- REAL astronomical data (never mixed with rendered values) ---------
    const realSection = el("section", "info-section");
    realSection.append(el("h3", "section-title", t("info.real")));
    const dayUnit = t("unit.days");
    const hourUnit = t("unit.hours");
    const realRows: Array<[string, string]> = [
      ["info.type", t(`type.${data.type}`)],
      ["info.actualRadius", `${formatNumber(data.radiusKm)} ${t("unit.km")}`],
      [ref.labelKey, ref.value],
      ["info.orbitPeriod", data.orbitalPeriodDays ? `${formatNumber(Math.abs(data.orbitalPeriodDays))} ${dayUnit}` : t("unit.na")],
      ["info.rotPeriod", data.rotationPeriodHours ? `${formatNumber(Math.abs(data.rotationPeriodHours))} ${hourUnit}` : t("unit.na")],
      ["info.eccentricity", data.eccentricity !== undefined ? data.eccentricity.toFixed(4) : t("unit.na")],
      ["info.inclination", data.inclinationDeg !== undefined ? `${data.inclinationDeg.toFixed(1)}°` : t("unit.na")],
    ];
    realSection.append(
      this.buildTable(realRows),
      children.length
        ? this.buildChildrenBlock(children, data.type === "star")
        : el("p", "empty-hint", t("info.noMoons")),
    );
    this.root.append(realSection);

    // --- RENDERED display values + active scales ---------------------------
    const renderSection = el("section", "info-section");
    renderSection.append(el("h3", "section-title", t("info.rendered")));
    const render = getRender(id);
    const renderRows: Array<[string, string]> = [
      ["info.renderDistance", render ? `${render.renderedDistance.toFixed(1)} ${t("unit.units")}` : t("unit.na")],
      ["info.distanceMode", modeLabel(DISTANCE_MODES, distanceMode)],
      ["info.renderRadius", render ? `${render.renderedRadius.toFixed(2)} ${t("unit.units")}` : t("unit.na")],
      ["info.sizeMode", modeLabel(SIZE_MODES, sizeMode)],
    ];
    renderSection.append(this.buildTable(renderRows));
    this.root.append(renderSection);
  }

  private buildTable(rows: Array<[string, string]>): HTMLTableElement {
    const table = el("table", "info-table");
    for (const [labelKey, v] of rows) {
      const tr = el("tr");
      const th = el("th", undefined, t(labelKey));
      tr.append(th, el("td", undefined, v));
      table.append(tr);
    }
    return table;
  }

  /** Distance reference label depends on whether the body orbits the Sun. */
  private actualReference(data: {
    type: string;
    semiMajorAxis?: number;
    semiMajorAxisUnit?: string;
  }): { labelKey: string; value: string } {
    if (data.semiMajorAxis === undefined) {
      return { labelKey: "info.meanDist", value: t("info.center") };
    }
    const unit = data.semiMajorAxisUnit ?? "AU";
    const isMoon = data.type === "moon";
    const labelKey = isMoon ? "info.moonDist" : "info.sunDist";
    if (unit === "AU") {
      return { labelKey, value: `${data.semiMajorAxis.toFixed(2)} ${t("unit.au")}` };
    }
    return { labelKey, value: `${formatNumber(data.semiMajorAxis)} ${t("unit.km")}` };
  }

  /** Children (moons for a planet, planets for the star). */
  private buildChildrenBlock(
    children: ReadonlyArray<{ nameKo: string; nameEn: string }>,
    isStar: boolean,
  ): HTMLElement {
    const block = el("div", "children-block");
    block.append(
      el("div", "children-title", t(isStar ? "info.childrenPlanets" : "info.childrenMoons")),
    );
    const chips = el("div", "children-chips");
    for (const child of children) {
      chips.append(el("span", "chip", bodyName(child)));
    }
    block.append(chips);
    return block;
  }
}

function modeLabel(
  list: ReadonlyArray<{ value: string; label: string }>,
  value: string,
): string {
  // Prefer the localized label; fall back to the constant's label, then value.
  const l10n = t(`mode.${value}`);
  if (l10n !== `mode.${value}`) return l10n;
  return list.find((m) => m.value === value)?.label ?? value;
}

/** Thousands-separated integer-ish number formatter (no spurious precision). */
function formatNumber(n: number): string {
  return n.toLocaleString(numberLocale(), {
    maximumFractionDigits: n >= 10000 ? 0 : 1,
  });
}
