/**
 * Application composition root.
 *
 * This is the ONLY place modules are constructed and wired together. It owns
 * the frame loop and global input (pointer / keyboard), coordinates selection
 * with the camera focus, and tears everything down. All per-module logic stays
 * inside its own module — this file never grows into "one big main.ts".
 */
import * as THREE from "three";
import type { CelestialBodyData } from "../types";
import { StateStore } from "./StateStore";
import { ScaleManager } from "./ScaleManager";
import { SimulationClock } from "./SimulationClock";
import { SceneManager } from "./SceneManager";
import { SolarSystem } from "./SolarSystem";
import { SelectionController } from "./SelectionController";
import { CameraFocus } from "./CameraFocus";
import { buildBodyIndex } from "../data/solarSystemData";
import { Labels } from "../ui/Labels";
import { ControlPanel } from "../ui/ControlPanel";
import { InfoPanel } from "../ui/InfoPanel";
import { Tooltip } from "../ui/Tooltip";
import {
  DEFAULT_DISTANCE_MODE,
  DEFAULT_SIZE_MODE,
  FOCUS_FILL_RATIO,
  INITIAL_CAMERA_POSITION,
  UI_HIDE_KEY,
} from "../config/constants";
import {
  getLocale,
  onLocaleChange,
  setLocale,
  t,
} from "../ui/i18n";

export class App {
  private readonly index = buildBodyIndex();
  private readonly store = new StateStore();
  private readonly scale = new ScaleManager();
  private readonly clock = new SimulationClock();
  private readonly selection: SelectionController;
  private readonly sceneManager: SceneManager;
  private readonly solarSystem: SolarSystem;
  private readonly controlPanel: ControlPanel;
  private readonly labels: Labels;
  private readonly cameraFocus: CameraFocus;

  private rafId = 0;
  private lastTime = 0;
  private disposed = false;
  private lastDistanceMode = DEFAULT_DISTANCE_MODE;
  private lastSizeMode = DEFAULT_SIZE_MODE;

  constructor(container: HTMLElement) {
    this.sceneManager = new SceneManager(container);
    this.solarSystem = new SolarSystem(this.index, this.scale, this.sceneManager, this.store);
    this.selection = new SelectionController(this.store);
    this.cameraFocus = new CameraFocus(this.sceneManager);

    // A manual rotate / zoom / pan cancels any in-flight focus tween so the
    // camera never snaps against the user's own gesture.
    this.sceneManager.controls.addEventListener("start", this.onControlsStart);

    this.controlPanel = new ControlPanel(this.index, this.store, {
      onResetView: () => this.resetView(),
      onResetSim: () => this.clock.reset(),
    });
    void new InfoPanel(this.index, this.store, (id) => this.renderMetrics(id));
    void new Tooltip(this.index, this.store);
    this.labels = new Labels(this.index, this.solarSystem, this.store);

    this.bindInput();
    this.bindSelection();
    this.bindUiToggle();
    this.bindLangToggle();
    this.bindLocalizedStatic();
    this.bindScaleRefocus();
    this.bindPlaybackSync();
    this.start();
  }

  private renderMetrics(id: string): { renderedDistance: number; renderedRadius: number } | undefined {
    const body = this.solarSystem.getBody(id);
    if (!body) return undefined;
    return { renderedDistance: body.renderDistance, renderedRadius: body.renderRadius };
  }

  /**
   * Re-fills all static (non-rebuilt) localized DOM on boot and on every
   * locale change: header title/subtitle, scale disclaimer, and the fixed
   * UI-hide button (whose text depends on both locale and hidden state).
   */
  private bindLocalizedStatic(): void {
    const title = document.getElementById("header-title");
    const subtitle = document.getElementById("header-subtitle");
    const disclaimer = document.getElementById("disclaimer");

    const apply = (): void => {
      if (title) title.textContent = t("header.title");
      if (subtitle) subtitle.textContent = t("header.subtitle");
      if (disclaimer) disclaimer.textContent = t("disclaimer");
      this.updateUiToggleText();
    };
    onLocaleChange(apply);
    apply();
  }

  // ---- language toggle ----------------------------------------------------

  /** EN/한글 switch in the header — flips the whole UI with no reload. */
  private bindLangToggle(): void {
    const btn = document.getElementById("lang-toggle");
    if (!btn) return;

    const apply = (locale = getLocale()): void => {
      btn.textContent = locale === "ko" ? "EN" : "한글";
      btn.setAttribute("aria-label", t(locale === "ko" ? "lang.toKo" : "lang.toEn"));
    };
    btn.addEventListener("click", () => setLocale(getLocale() === "ko" ? "en" : "ko"));
    onLocaleChange(apply);
    apply();
  }

  // ---- input ---------------------------------------------------------------

  private bindInput(): void {
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("dblclick", this.onDoubleClick);
    window.addEventListener("keydown", this.onKeyDown);
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    const ndc = this.sceneManager.pointerToNdc(e.clientX, e.clientY);
    this.selection.setHovered(this.solarSystem.raycast(ndc));
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    // Right-drag pans (OrbitControls); primary click selects.
    if (e.button !== 0) return;
    const ndc = this.sceneManager.pointerToNdc(e.clientX, e.clientY);
    const id = this.solarSystem.raycast(ndc);
    if (id) this.selectBody(id);
  };

  private readonly onDoubleClick = (): void => {
    this.resetView();
  };

  private readonly onControlsStart = (): void => {
    this.cameraFocus.cancel();
  };

  /**
   * Keep the SimulationClock in sync with the UI playback/time controls. The
   * ControlPanel writes `playing` and `timeScaleDaysPerSecond` into the store,
   * but only the clock owns the actual accumulated simulation time, so those
   * settings must be propagated here for Play/Pause and the time-scale selector
   * to have any effect on real motion.
   */
  private bindPlaybackSync(): void {
    this.store.on("settings", ({ settings }) => {
      if (settings.playing !== this.clock.isPlaying()) {
        this.clock.setPlaying(settings.playing);
      }
      const scale = settings.timeScaleDaysPerSecond;
      if (scale !== this.clock.getTimeScale()) {
        this.clock.setTimeScale(scale);
      }
    });
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    // Never toggle while typing in a form control.
    const tag = (e.target as HTMLElement | null)?.tagName ?? "";
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.key.toLowerCase() === UI_HIDE_KEY) {
      this.toggleUiHidden();
    }
  };

  private toggleUiHidden(): void {
    const hidden = !this.store.getSettings().uiHidden;
    this.store.setSettings({ uiHidden: hidden });
    // Toggling a body class hides the whole HUD via CSS; the canvas and its
    // controls/interaction remain live (they are outside that container).
    document.body.classList.toggle("ui-hidden", hidden);
  }

  /**
   * Always-accessible fixed toggle (lives outside the hidden HUD) so the UI can
   * be restored even when every overlay is hidden. Reflects H-key state too.
   */
  private bindUiToggle(): void {
    const btn = document.getElementById("ui-toggle");
    if (!btn) return;
    btn.addEventListener("click", () => this.toggleUiHidden());
    this.store.on("settings", ({ settings }) => {
      btn.setAttribute("aria-pressed", String(settings.uiHidden));
      this.updateUiToggleText();
    });
  }

  /** UI-toggle label = current locale + current hidden state. */
  private updateUiToggleText(): void {
    const btn = document.getElementById("ui-toggle");
    if (!btn) return;
    const hidden = this.store.getSettings().uiHidden;
    btn.textContent = hidden ? t("ui.show") : t("ui.hide");
  }

  private selectBody(id: string): void {
    const data = this.index.byId.get(id);
    this.selection.select(id, data?.type === "star");
    this.selection.setHovered(id);
  }

  private resetView(): void {
    this.selection.clearSelection();
    this.returnToWholeView();
  }

  /** Tween camera + target back to the initial whole-system composition. */
  private returnToWholeView(): void {
    this.scale.setFocusDistanceAU(null);
    const initial = new THREE.Vector3(
      INITIAL_CAMERA_POSITION.x,
      INITIAL_CAMERA_POSITION.y,
      INITIAL_CAMERA_POSITION.z,
    );
    this.cameraFocus.resetWhole(initial);
  }

  // ---- selection -> camera focus ------------------------------------------

  private bindSelection(): void {
    this.store.on("select", ({ id }) => this.focusOn(id));
  }

  /** Re-frame the selected system when the distance/size scale changes. */
  private bindScaleRefocus(): void {
    this.store.on("settings", ({ settings }) => {
      const distanceChanged = settings.distanceMode !== this.lastDistanceMode;
      const sizeChanged = settings.sizeMode !== this.lastSizeMode;
      this.lastDistanceMode = settings.distanceMode;
      this.lastSizeMode = settings.sizeMode;
      if (!distanceChanged && !sizeChanged) return;
      const selected = this.selection.getSelected();
      const data = selected ? this.index.byId.get(selected) : undefined;
      if (data && data.type !== "star") this.focusOn(selected);
    });
  }

  /**
   * Move the camera target onto a body (or back to the whole system).
   *
   * Solar view: Sun / null => whole system, initial oblique framing.
   * Detail view: planet → itself + its moon system; moon → its parent planet
   * (so a moon is always seen together with the parent, per the spec).
   * The tween eases camera position and target in together.
   */
  private focusOn(id: string | null): void {
    const data = id ? this.index.byId.get(id) : undefined;

    // Sun (or explicit clear) => whole solar-system view.
    if (!data || data.type === "star") {
      this.returnToWholeView();
      return;
    }

    // Moons are framed together with their parent planet. `id` is non-null
    // here because a null id produced undefined data and returned above.
    const idNonNull = id as string;
    const focusId =
      data.type === "moon" && data.parentId ? data.parentId : idNonNull;
    const focusData = this.index.byId.get(focusId);
    const body = this.solarSystem.getBody(focusId);
    if (!body || !focusData) {
      this.returnToWholeView();
      return;
    }

    const target = body.sceneGroup.getWorldPosition(new THREE.Vector3());
    this.cameraFocus.focusBody(target, this.framingDistance(focusId, focusData));

    // Focus-scale distances recentre on the selected planetary system.
    if (focusData.semiMajorAxisUnit === "AU") {
      this.scale.setFocusDistanceAU(focusData.semiMajorAxis ?? null);
    } else {
      this.scale.setFocusDistanceAU(null);
    }
    // Broadcast so InfoPanel render values and orbit visuals refresh.
    this.store.setSettings({});
  }

  /**
   * Framing distance that fits the focused system in the viewport: for a
   * planet/dwarf-planet the whole local moon system (≤9× parent radius), else
   * just the body radius plus a margin.
   */
  private framingDistance(id: string, data: CelestialBodyData): number {
    const body = this.solarSystem.getBody(id);
    const radius = body?.renderRadius ?? 4;
    const isCollector = data.type === "planet" || data.type === "dwarf-planet";
    const children = this.index.childrenOf.get(id) ?? [];
    const hasMoons = children.some((c) => c.type === "moon");
    const extent = isCollector && hasMoons ? radius * 9 : radius * 2;
    const fov = THREE.MathUtils.degToRad(this.sceneManager.camera.fov);
    return Math.max(6, (extent / Math.tan(fov / 2)) * FOCUS_FILL_RATIO);
  }

  // ---- frame loop ----------------------------------------------------------

  private start(): void {
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private readonly loop = (time: number): void => {
    if (this.disposed) return;
    const deltaMs = time - this.lastTime;
    this.lastTime = time;

    this.clock.update(deltaMs);
    this.solarSystem.update(this.clock.getElapsedDays());
    this.cameraFocus.update(deltaMs);
    this.sceneManager.render();
    // After rendering, world matrices are current — re-evaluate label fade/cull.
    this.labels.update(this.sceneManager.camera);
    this.controlPanel.setElapsedDays(this.clock.getElapsedDays());

    this.rafId = requestAnimationFrame(this.loop);
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.sceneManager.controls.removeEventListener("start", this.onControlsStart);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("dblclick", this.onDoubleClick);
    window.removeEventListener("keydown", this.onKeyDown);
    this.labels.dispose();
    this.solarSystem.dispose();
    this.sceneManager.dispose();
  }
}
