/**
 * Owns pointer-selection state (hovered / selected body) and the derived
 * camera view mode. It only stores state and notifies the StateStore — the
 * camera / render modules subscribe and react, keeping concerns separate.
 */
import type { StateStore } from "./StateStore";
import type { ViewMode } from "../types";

export class SelectionController {
  private hoveredId: string | null = null;
  private selectedId: string | null = null;
  private viewMode: ViewMode = "solar-system";

  constructor(private readonly store: StateStore) {}

  /** Pointer moved onto a body (or null to clear the hover). */
  setHovered(id: string | null): void {
    this.hoveredId = id;
    this.store.emit("hover", { id });
  }

  getHovered(): string | null {
    return this.hoveredId;
  }

  /** User clicked a body: select it and derive the appropriate view mode. */
  select(id: string | null, isStar: boolean): void {
    this.selectedId = id;
    // Sun (or explicit clear) => whole system; anything else => its system.
    if (id === null || isStar) {
      this.viewMode = "solar-system";
    } else {
      this.viewMode = "planetary-system";
    }
    // In a planetary-system view the focus is the selected body's parent;
    // for a planet the parent is the whole system (solar) — handled by App.
    this.store.emit("select", { id });
  }

  /** Clear selection and return to the whole-system view. */
  clearSelection(): void {
    this.selectedId = null;
    this.viewMode = "solar-system";
    this.store.emit("select", { id: null });
  }

  getSelected(): string | null {
    return this.selectedId;
  }

  getViewMode(): ViewMode {
    return this.viewMode;
  }
}
