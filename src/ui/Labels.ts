/**
 * CSS2D scene labels.
 *
 * Always shows the Sun / planets / Pluto; moon labels appear only while their
 * parent planet is selected. Every frame the labels re-evaluate themselves so
 * they fade naturally: labels behind or far off-screen are culled, labels very
 * close to / very far from the camera fade out, and a greedy spacing pass
 * reduces density when labels would overlap. On small screens density is lower
 * (see styles.css: English line hidden, smaller fonts).
 *
 * All labels hide together with the whole UI overlay.
 */
import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { BodyIndex, CelestialBodyData } from "../types";
import type { StateStore } from "../core/StateStore";
import type { SolarSystem } from "../core/SolarSystem";
import { MOBILE_BREAKPOINT_PX } from "../config/constants";
import { el } from "./dom";
import {
  bodyName,
  onLocaleChange,
  otherBodyName,
} from "./i18n";

interface LabelEntry {
  label: CSS2DObject;
  koEl: HTMLElement;
  enEl: HTMLElement;
  data: CelestialBodyData;
  anchor: THREE.Object3D;
  opacity: number;
}

/** Beyond this camera distance labels fade out to cut clutter at system scale. */
const FAR_FADE_START = 320;
const FAR_FADE_END = 520;
/** Minimum on-screen spacing (px) between two labels before one is faded. */
const MIN_SPACING_DESKTOP = 48;
const MIN_SPACING_MOBILE = 76;
/** Screen-edge margin (px) where a label is considered off-screen. */
const EDGE_MARGIN_PX = 20;
/** Opacity below which a label element is hidden (also avoids DOM writes). */
const EPS = 0.02;

// Reused temporaries so no Vector is allocated per frame (perf requirement).
const TMP_WORLD = new THREE.Vector3();
const TMP_NDC = new THREE.Vector3();

interface Candidate {
  entry: LabelEntry;
  px: { x: number; y: number };
  fade: number;
}

export class Labels {
  private readonly entries: LabelEntry[] = [];
  private showLabels = true;
  private uiHidden = false;
  private selectedId: string | null = null;
  private isMobile = window.innerWidth <= MOBILE_BREAKPOINT_PX;
  private disposed = false;
  private unsubscribeLocale: (() => void) | null = null;

  constructor(
    index: BodyIndex,
    solarSystem: SolarSystem,
    store: StateStore,
  ) {
    for (const body of index.byId.values()) {
      const bodyNode = solarSystem.getBody(body.id);
      if (!bodyNode) continue;
      const built = this.build();
      const anchor = bodyNode.getLabelAnchor();
      anchor.add(built.label);
      this.entries.push({
        label: built.label,
        koEl: built.koEl,
        enEl: built.enEl,
        data: body,
        anchor,
        opacity: 1,
      });
    }

    window.addEventListener("resize", this.onResize);
    this.applyLocale();
    this.unsubscribeLocale = onLocaleChange(() => this.applyLocale());

    store.on("settings", ({ settings }) => {
      this.showLabels = settings.showLabels;
      this.uiHidden = settings.uiHidden;
    });
    store.on("select", ({ id }) => {
      this.selectedId = id;
    });
  }

  /** Update each label's language line to match the active locale. */
  private applyLocale(): void {
    for (const entry of this.entries) {
      entry.koEl.textContent = bodyName(entry.data);
      entry.enEl.textContent = otherBodyName(entry.data);
    }
  }

  private readonly onResize = (): void => {
    this.isMobile = window.innerWidth <= MOBILE_BREAKPOINT_PX;
  };

  private build(): {
    label: CSS2DObject;
    koEl: HTMLElement;
    enEl: HTMLElement;
  } {
    const box = el("div", "label");
    const koEl = el("div", "label-ko", "");
    const enEl = el("div", "label-en", "");
    box.append(koEl, enEl);
    return { label: new CSS2DObject(box), koEl, enEl };
  }

  /** Selection rules: Sun/planets/Pluto always; moons only on parent select. */
  private desired(data: CelestialBodyData): boolean {
    if (!this.showLabels || this.uiHidden) return false;
    if (data.type === "moon") {
      return data.parentId != null && data.parentId === this.selectedId;
    }
    return true;
  }

  /**
   * Called once per frame (after rendering so world matrices are current).
   * Fades labels by camera distance, culls off-screen ones and keeps only
   * labels that are far enough apart on screen.
   */
  update(camera: THREE.Camera): void {
    if (this.disposed) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const spacing = this.isMobile ? MIN_SPACING_MOBILE : MIN_SPACING_DESKTOP;

    const candidates: Candidate[] = [];
    for (const entry of this.entries) {
      if (!this.desired(entry.data)) {
        this.setOpacity(entry, 0);
        continue;
      }
      entry.anchor.getWorldPosition(TMP_WORLD);
      TMP_NDC.copy(TMP_WORLD).project(camera);
      // Behind the camera or outside the clip volume -> off screen.
      if (TMP_NDC.z > 1 || TMP_NDC.z < -1) {
        this.setOpacity(entry, 0);
        continue;
      }
      const px = {
        x: (TMP_NDC.x + 1) * 0.5 * width,
        y: (1 - TMP_NDC.y) * 0.5 * height,
      };
      if (
        px.x < -EDGE_MARGIN_PX ||
        px.x > width + EDGE_MARGIN_PX ||
        px.y < -EDGE_MARGIN_PX ||
        px.y > height + EDGE_MARGIN_PX
      ) {
        this.setOpacity(entry, 0);
        continue;
      }
      const camDist = TMP_WORLD.distanceTo(camera.position);
      candidates.push({ entry, px, fade: this.cameraFade(camDist) });
    }

    // Greedy density pass: keep, in priority order, labels at least `spacing`
    // apart on screen; fade the rest (stable sort keeps inner bodies first).
    candidates.sort((a, b) => priorityOf(a.entry.data) - priorityOf(b.entry.data));
    const accepted: Array<{ x: number; y: number }> = [];
    for (const c of candidates) {
      let room = true;
      for (const a of accepted) {
        if (Math.hypot(a.x - c.px.x, a.y - c.px.y) < spacing) {
          room = false;
          break;
        }
      }
      if (room) accepted.push(c.px);
      this.setOpacity(c.entry, room ? c.fade : 0);
    }
  }

  /** Combine a near fade (label hugging the body) and a far fade (clutter). */
  private cameraFade(dist: number): number {
    let near = 1;
    if (dist < 18) near = clamp((dist - 7) / 11, 0, 1);
    let far = 1;
    if (dist > FAR_FADE_START) {
      far = 1 - clamp((dist - FAR_FADE_START) / (FAR_FADE_END - FAR_FADE_START), 0, 1);
    }
    return near * far;
  }

  private setOpacity(entry: LabelEntry, opacity: number): void {
    const target = opacity <= EPS ? 0 : opacity;
    if (Math.abs(entry.opacity - target) < EPS) {
      // Already at target: guarantee hidden state without touching the DOM.
      if (target === 0 && entry.label.element.style.display !== "none") {
        entry.label.element.style.display = "none";
      }
      return;
    }
    entry.opacity = target;
    const elm = entry.label.element;
    elm.style.opacity = String(target);
    elm.style.display = target === 0 ? "none" : "block";
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("resize", this.onResize);
    this.unsubscribeLocale?.();
  }
}

function priorityOf(data: CelestialBodyData): number {
  if (data.type === "star") return 0;
  if (data.type === "moon") return 2;
  return 1; // planets + dwarf planets
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
