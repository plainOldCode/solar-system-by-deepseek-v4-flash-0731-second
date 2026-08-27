/**
 * Compact hover tooltip: local-language name + secondary name and object type,
 * following the pointer and hiding when the whole UI is hidden. Re-renders the
 * current body when the language flips.
 */
import type { BodyIndex, CelestialBodyData } from "../types";
import type { StateStore } from "../core/StateStore";
import { clear, el } from "./dom";
import {
  bodyName,
  onLocaleChange,
  otherBodyName,
  t,
} from "./i18n";

export class Tooltip {
  private readonly root: HTMLElement;
  private lastX = 0;
  private lastY = 0;
  private current: CelestialBodyData | null = null;

  constructor(private readonly index: BodyIndex, store: StateStore) {
    this.root = document.querySelector("#tooltip") as HTMLElement;

    const render = (): void => {
      if (!this.current) {
        this.root.hidden = true;
        return;
      }
      clear(this.root);
      this.root.append(
        el("div", "tip-ko", bodyName(this.current)),
        el("div", "tip-en", otherBodyName(this.current)),
        el("div", "tip-type", t(`type.${this.current.type}`)),
      );
      this.root.hidden = false;
      this.position();
    };

    window.addEventListener("pointermove", (e: PointerEvent) => {
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.position();
    });

    store.on("hover", ({ id }) => {
      const data = id ? this.index.byId.get(id) : undefined;
      this.current = data ?? null;
      render();
    });

    store.on("settings", ({ settings }) => {
      if (settings.uiHidden && !this.root.hidden) this.root.hidden = true;
    });

    onLocaleChange(render);
  }

  private position(): void {
    if (this.root.hidden) return;
    this.root.style.left = `${this.lastX + 12}px`;
    this.root.style.top = `${this.lastY + 12}px`;
  }
}
