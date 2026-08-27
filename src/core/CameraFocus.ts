/**
 * Smooth camera focus controller.
 *
 * Owns the tween that carries the camera position and the OrbitControls
 * target to a selected body (planetary detail view) or back to the initial
 * whole-system composition, using a cubic ease-in-out so transitions are
 * gentle rather than abrupt. It never touches the renderer or scene graph —
 * only `OrbitControls` state — so it cannot fight the user's own rotate /
 * zoom / pan gestures.
 *
 * A focus request snapshots the goal target at call time (the selected body
 * moves slowly enough that a one-second approach to a fixed point is fine)
 * and preserves the user's current viewing direction, merely dollied in/out
 * to the required framing distance. Any manual OrbitControls interaction
 * cancels the active tween so the camera never snaps against user input.
 */
import * as THREE from "three";
import type { SceneManager } from "./SceneManager";
import { FOCUS_EASE_DURATION_MS } from "../config/constants";

/** Cubic ease-in-out; smooth entry and exit, no linear creep. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface FocusTween {
  elapsedMs: number;
  durationMs: number;
  startTarget: THREE.Vector3;
  goalTarget: THREE.Vector3;
  startCamera: THREE.Vector3;
  goalCamera: THREE.Vector3;
}

export class CameraFocus {
  private tween: FocusTween | null = null;
  /** Reused temporary so no Vector is allocated per focus request. */
  private readonly dir = new THREE.Vector3();

  constructor(private readonly sceneManager: SceneManager) {}

  /**
   * Dolly the camera toward `target` so the body (and, for planets, its moon
   * system) fits within the viewport at `framingDistance` from the target.
   */
  focusBody(target: THREE.Vector3, framingDistance: number): void {
    const controls = this.sceneManager.controls;
    const camera = controls.object;
    const dir = this.dir.subVectors(camera.position, controls.target);
    if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
    dir.normalize();

    const goalCamera = target.clone().addScaledVector(dir, framingDistance);
    this.start(
      controls.target.clone(),
      target.clone(),
      camera.position.clone(),
      goalCamera,
    );
  }

  /** Return to the initial whole-system composition (oblique pose, origin target). */
  resetWhole(initialPosition: THREE.Vector3): void {
    const controls = this.sceneManager.controls;
    const camera = controls.object;
    this.start(
      controls.target.clone(),
      new THREE.Vector3(0, 0, 0),
      camera.position.clone(),
      initialPosition.clone(),
    );
  }

  /** Immediately drop any in-flight tween (user grabbed the controls). */
  cancel(): void {
    this.tween = null;
  }

  isActive(): boolean {
    return this.tween !== null;
  }

  /** Advance the tween by real elapsed ms. Mutates camera + controls target. */
  update(deltaMs: number): void {
    const tween = this.tween;
    if (!tween) return;
    tween.elapsedMs += deltaMs;
    const t = Math.min(1, tween.elapsedMs / tween.durationMs);
    const e = easeInOutCubic(t);

    this.sceneManager.controls.target.lerpVectors(tween.startTarget, tween.goalTarget, e);
    this.sceneManager.controls.object.position.lerpVectors(
      tween.startCamera,
      tween.goalCamera,
      e,
    );

    if (t >= 1) this.tween = null;
  }

  private start(
    startTarget: THREE.Vector3,
    goalTarget: THREE.Vector3,
    startCamera: THREE.Vector3,
    goalCamera: THREE.Vector3,
  ): void {
    this.tween = {
      elapsedMs: 0,
      durationMs: FOCUS_EASE_DURATION_MS,
      startTarget,
      goalTarget,
      startCamera,
      goalCamera,
    };
  }
}
