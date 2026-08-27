/**
 * Control panel: playback + time scale, distance/size scale selectors,
 * visibility toggles, camera reset and a Back-to-system button.
 *
 * Mutations flow through the StateStore so both core and UI react without a
 * central controller knowing every module. Every display string is resolved
 * from the i18n dictionary so the EN/한글 toggle flips the whole panel in place.
 */
import type { BodyIndex, DistanceMode, SizeMode } from "../types";
import type { StateStore } from "../core/StateStore";
import { SIZE_MODES, DISTANCE_MODES } from "../config/constants";
import { SUPPORTED_TIME_SCALES } from "../core/SimulationClock";
import { button, el } from "./dom";
import {
  numberLocale,
  onLocaleChange,
  t,
  tpl,
} from "./i18n";

export interface ControlPanelActions {
  onResetView: () => void;
  onResetSim: () => void;
}

type ToggleKey = "showOrbits" | "showLabels" | "showMoons" | "showStarfield";
type ModeKey = DistanceMode | SizeMode;

/** Resolve a distance/size mode's display label for the active locale. */
function modeLabel(mode: ModeKey): string {
  return t(`mode.${mode}`);
}

/** Rebuild the option text of a scale-mode <select> for the active locale. */
function setModeOptionTexts(select: HTMLSelectElement): void {
  for (const opt of Array.from(select.options)) {
    opt.textContent = modeLabel(opt.value as ModeKey);
  }
}

export class ControlPanel {
  private readonly root: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly resetBtn: HTMLButtonElement;
  private readonly fullviewBtn: HTMLButtonElement;
  private readonly backBtn: HTMLButtonElement;
  private readonly timeSelect: HTMLSelectElement;
  private readonly distanceSelect: HTMLSelectElement;
  private readonly sizeSelect: HTMLSelectElement;
  private readonly dayEl: HTMLElement;
  private readonly timeRowLabel: HTMLElement;
  private readonly simRowLabel: HTMLElement;
  private readonly distanceLabel: HTMLElement;
  private readonly sizeLabel: HTMLElement;
  private readonly toggleLabels: Record<ToggleKey, HTMLElement>;
  private lastDays = 0;

  constructor(
    private readonly index: BodyIndex,
    private readonly store: StateStore,
    actions: ControlPanelActions,
  ) {
    this.root = document.querySelector("#control-panel") as HTMLElement;

    this.root.append(el("h2", "panel-title", t("ctrl.title")));

    const rowPlay = el("div", "row");
    this.playBtn = button(t("ctrl.pause"), "btn", () => {
      store.setSettings({ playing: !store.getSettings().playing });
    });
    this.resetBtn = button(t("ctrl.reset"), "btn", actions.onResetSim);
    this.fullviewBtn = button(t("ctrl.fullView"), "btn", actions.onResetView);
    this.backBtn = button(t("ctrl.back"), "btn", actions.onResetView);
    // Back is only meaningful while a body detail view is active.
    this.backBtn.hidden = true;
    rowPlay.append(this.playBtn, this.resetBtn, this.fullviewBtn, this.backBtn);
    this.root.append(rowPlay);

    const timeRow = el("div", "row");
    this.timeSelect = el("select", "select");
    this.timeRowLabel = el("span", "label", t("ctrl.timeScale"));
    this.timeSelect.value = String(store.getSettings().timeScaleDaysPerSecond);
    this.timeSelect.addEventListener("change", () => {
      store.setSettings({ timeScaleDaysPerSecond: Number(this.timeSelect.value) });
    });
    timeRow.append(this.timeRowLabel, this.timeSelect);
    this.root.append(timeRow);

    const simRow = el("div", "row");
    this.dayEl = el("span", "sim-readout", "");
    this.simRowLabel = el("span", "label", t("ctrl.sim"));
    simRow.append(this.simRowLabel, this.dayEl);
    this.root.append(simRow);

    const distance = this.appendScaleRow("ctrl.distance", DISTANCE_MODES, this.store.getSettings().distanceMode);
    this.distanceSelect = distance.select;
    this.distanceLabel = distance.label;
    const size = this.appendScaleRow("ctrl.size", SIZE_MODES, this.store.getSettings().sizeMode);
    this.sizeSelect = size.select;
    this.sizeLabel = size.label;

    // Track scale-select rows so their row-label refs are set after append.
    this.toggleLabels = {} as Record<ToggleKey, HTMLElement>;
    const toggles = el("div", "toggles");
    const items: Array<{ key: ToggleKey; labelKey: string }> = [
      { key: "showOrbits", labelKey: "ctrl.orbits" },
      { key: "showLabels", labelKey: "ctrl.labels" },
      { key: "showMoons", labelKey: "ctrl.moons" },
      { key: "showStarfield", labelKey: "ctrl.starfield" },
    ];
    for (const item of items) {
      const cb = el("input") as HTMLInputElement;
      cb.type = "checkbox";
      cb.checked = store.getSettings()[item.key];
      cb.addEventListener("change", () =>
        store.setSettings({ [item.key]: cb.checked }),
      );
      const wrap = el("label", "toggle");
      const span = el("span", undefined, t(item.labelKey));
      this.toggleLabels[item.key] = span;
      wrap.append(cb, span);
      toggles.append(wrap);
    }
    this.root.append(toggles);

    store.on("settings", ({ settings }) => {
      this.playBtn.textContent = settings.playing ? t("ctrl.pause") : t("ctrl.play");
      this.timeSelect.value = String(settings.timeScaleDaysPerSecond);
    });
    // Show Back only while a body detail view is active (non-star selected).
    store.on("select", ({ id }) => {
      const data = id ? this.index.byId.get(id) : undefined;
      this.backBtn.hidden = !data || data.type === "star";
    });

    // Keep all strings current when the language flips.
    onLocaleChange(() => this.applyLocale());
    this.applyLocale();
  }

  /** Called each frame by the app with the accumulated simulation time. */
  setElapsedDays(days: number): void {
    this.lastDays = days;
    this.dayEl.textContent = tpl("ctrl.elapsed", {
      n: days.toLocaleString(numberLocale(), { maximumFractionDigits: 0 }),
    });
  }

  /** Re-resolve every string in the panel for the active locale. */
  private applyLocale(): void {
    const title = this.root.querySelector(".panel-title") as HTMLElement | null;
    if (title) title.textContent = t("ctrl.title");

    const settings = this.store.getSettings();
    this.playBtn.textContent = settings.playing ? t("ctrl.pause") : t("ctrl.play");
    this.resetBtn.textContent = t("ctrl.reset");
    this.fullviewBtn.textContent = t("ctrl.fullView");
    this.backBtn.textContent = t("ctrl.back");

    this.timeRowLabel.textContent = t("ctrl.timeScale");
    this.setTimeScaleOptionTexts(String(this.store.getSettings().timeScaleDaysPerSecond));

    this.simRowLabel.textContent = t("ctrl.sim");
    this.dayEl.textContent = tpl("ctrl.elapsed", {
      n: this.lastDays.toLocaleString(numberLocale(), { maximumFractionDigits: 0 }),
    });

    this.distanceLabel.textContent = t("ctrl.distance");
    setModeOptionTexts(this.distanceSelect);
    this.sizeLabel.textContent = t("ctrl.size");
    setModeOptionTexts(this.sizeSelect);

    (Object.keys(this.toggleLabels) as ToggleKey[]).forEach((key) => {
      const map: Record<ToggleKey, string> = {
        showOrbits: "ctrl.orbits",
        showLabels: "ctrl.labels",
        showMoons: "ctrl.moons",
        showStarfield: "ctrl.starfield",
      };
      this.toggleLabels[key].textContent = t(map[key]);
    });
  }

  /** Rebuild the time-scale <select> options for the active locale, keeping
   *  the given value selected (values stay stable so a preserved scale holds). */
  private setTimeScaleOptionTexts(selectedValue: string): void {
    this.timeSelect.replaceChildren();
    for (const s of SUPPORTED_TIME_SCALES) {
      const opt = el("option");
      opt.value = String(s);
      opt.textContent =
        s === 365 ? t("ctrl.time.year") : tpl("ctrl.time.days", { n: s });
      this.timeSelect.append(opt);
    }
    this.timeSelect.value = selectedValue;
  }

  /** Build a "label + select" row and wire the select to a store mutation. */
  private appendScaleRow(
    labelKey: string,
    modes: ReadonlyArray<{ value: string }>,
    current: DistanceMode | SizeMode,
  ): { select: HTMLSelectElement; label: HTMLElement } {
    const row = el("div", "row");
    const label = el("span", "label", t(labelKey));
    const select = el("select", "select");
    for (const opt of modes) {
      const o = el("option");
      o.value = opt.value;
      o.textContent = modeLabel(opt.value as ModeKey);
      select.append(o);
    }
    select.value = String(current);
    const isSize = labelKey === "ctrl.size";
    select.addEventListener("change", () => {
      this.store.setSettings(
        isSize
          ? { sizeMode: select.value as SizeMode }
          : { distanceMode: select.value as DistanceMode },
      );
    });
    row.append(label, select);
    this.root.append(row);
    return { select, label };
  }
}
