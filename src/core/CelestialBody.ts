/**
 * A single celestial body placed in a scene: a THREE group containing a
 * normalized inner size-group (sphere mesh + optional rings) and an anchor for
 * its CSS2D label.
 *
 * The body's `sceneGroup` sits in its PARENT frame (scene root for planets, a
 * planet group for moons). Its local position is driven by `update(timeDays)`
 * along a **Keplerian elliptical orbit**: mean anomaly is derived from the
 * accumulated simulation time and the REAL orbital period, solved through
 * Kepler's equation, and tilted out of the reference plane by the body's
 * orbital inclination. Nothing here depends on frame count or per-body
 * arbitrary speeds.
 *
 * Geometry is normalized to the real radius up front, so switching size modes
 * only rescales `sizeGroup`; orbits are recomputed every frame but never
 * create objects (all updates mutate existing Vector3 / numbers).
 */
import * as THREE from "three";
import type { CelestialBodyData } from "../types";
import { makeSurfaceTexture, makeRingTexture } from "./textures";

const TAU = Math.PI * 2;

/** Deterministic per-id phase so bodies do not all start aligned. */
function phaseFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % 360;
  return (h / 360) * TAU;
}

export class CelestialBody {
  readonly id: string;
  readonly data: CelestialBodyData;
  readonly sceneGroup: THREE.Group;
  /** Rendered orbital semi-major axis from the parent, in scene units. */
  renderDistance = 0;
  /** Rendered body radius, in scene units. */
  renderRadius = 0;

  private readonly sizeGroup: THREE.Group;
  private readonly labelAnchor: THREE.Object3D;
  private readonly orbitalPeriodDays: number;
  private readonly eccentricity: number;
  private readonly phase: number;

  /** Sphere materials, tracked so emphasis (dimming) can be toggled cheaply. */
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly disposables: Array<{ dispose(): void }> = [];

  constructor(data: CelestialBodyData, isSun: boolean) {
    this.id = data.id;
    this.data = data;

    this.phase = phaseFor(data.id);
    this.orbitalPeriodDays =
      data.orbitalPeriodDays && data.orbitalPeriodDays > 0
        ? data.orbitalPeriodDays
        : 0;
    this.eccentricity = data.eccentricity ?? 0;

    this.sceneGroup = new THREE.Group();
    this.sceneGroup.userData.bodyId = data.id;

    this.sizeGroup = new THREE.Group();
    this.sceneGroup.add(this.sizeGroup);

    if (isSun) {
      // Emissive-style unlit Sun; real illumination comes from the point light
      // placed at the Sun in the scene graph.
      const material = new THREE.MeshBasicMaterial({
        color: data.displayColor,
      });
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 48),
        material,
      );
      this.sizeGroup.add(mesh);
      this.bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
      this.disposables.push(material, this.bodyMaterial);
    } else {
      const surface = makeSurfaceTexture(data.id, data.type, data.displayColor);
      // Only set `map` when a texture was generated — passing `map: undefined`
      // makes Three.js log a "parameter 'map' has value of undefined" warning.
      const materialParams: THREE.MeshStandardMaterialParameters = {
        color: data.displayColor,
        roughness: 0.85,
        metalness: 0.05,
      };
      if (surface) materialParams.map = surface;
      this.bodyMaterial = new THREE.MeshStandardMaterial(materialParams);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 48),
        this.bodyMaterial,
      );
      mesh.userData.bodyId = data.id;
      this.sizeGroup.add(mesh);
      if (surface) this.disposables.push(surface);
    }

    if (data.hasRings && data.ringInnerKm && data.ringOuterKm) {
      const unit = 1 / data.radiusKm;
      const ringTex = makeRingTexture(data.displayColor);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(data.ringInnerKm * unit, data.ringOuterKm * unit, 96),
        new THREE.MeshBasicMaterial({
          map: ringTex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.sizeGroup.add(ring);
      this.disposables.push(ringTex);
    }

    this.labelAnchor = new THREE.Object3D();
    this.sceneGroup.add(this.labelAnchor);
  }

  /** Apply a new rendered radius by scaling the normalized size group. */
  setSize(renderRadius: number): void {
    this.renderRadius = renderRadius;
    this.sizeGroup.scale.setScalar(renderRadius);
    // Keep the label clear of the surface.
    this.labelAnchor.position.set(0, renderRadius + 1.6, 0);
  }

  /** Object3D a CSS2D label should attach to (tracks the body automatically). */
  getLabelAnchor(): THREE.Object3D {
    return this.labelAnchor;
  }

  /**
   * Solve Kepler's equation M = E - e·sin(E) for the eccentric anomaly E
   * (Newton iteration; M is normalised to [0, 2π) so it never grows
   * unbounded across long runs).
   */
  private solveKeplerElliptic(M: number, e: number): number {
    let E = M;
    for (let i = 0; i < 24; i += 1) {
      const f = E - e * Math.sin(E) - M;
      const fp = 1 - e * Math.cos(E);
      const dE = f / fp;
      E -= dE;
      if (Math.abs(dE) < 1e-7) break;
    }
    return E;
  }

  /**
   * Advance the body by cumulative simulated time (days), placing it on a
   * Keplerian elliptical orbit whose semi-major axis is `renderDistance`.
   * The ellipse has its focus at the parent's origin (so the offset from the
   * orbit centre equals a·e, making eccentricity visually obvious) and is
   * tilted about its line of nodes (the +X axis) by `inclinationDeg`.
   */
  update(timeDays: number, inclinationDeg: number): void {
    if (this.orbitalPeriodDays === 0) {
      this.sceneGroup.position.set(0, 0, 0);
      return;
    }

    // Mean anomaly from accumulated sim time + fixed phase (periodic → mod 2π)
    // so behaviour is identical at any frame rate and over long runs.
    const M =
      (((timeDays / this.orbitalPeriodDays) * TAU + this.phase) % TAU + TAU) % TAU;
    const e = this.eccentricity;
    const a = this.renderDistance;
    const s1me2 = Math.sqrt(Math.max(0, 1 - e * e));

    const E = this.solveKeplerElliptic(M, e);
    // Position relative to the ORBIT CENTRE, then offset so the Sun sits at a
    // focus: x = a·(cos E + e), z = a·sqrt(1-e²)·sin E.
    const x = a * (e + Math.cos(E));
    const z = a * s1me2 * Math.sin(E);

    // Tilt the orbital plane about the line of nodes (X axis) by inclination.
    const inc = THREE.MathUtils.degToRad(inclinationDeg);
    const cosI = Math.cos(inc);
    const sinI = Math.sin(inc);
    this.sceneGroup.position.set(x, -z * sinI, z * cosI);
  }

  setVisible(visible: boolean): void {
    this.sceneGroup.visible = visible;
  }

  /**
   * Emphasise or dim this body relative to the rest of the scene (used in the
   * planetary detail view to de-emphasise non-selected planets). Only mutates
   * material flags — no geometry or object allocation.
   */
  setEmphasis(dimmed: boolean): void {
    this.bodyMaterial.transparent = dimmed;
    this.bodyMaterial.opacity = dimmed ? 0.3 : 1;
    if (this.bodyMaterial.needsUpdate) this.bodyMaterial.needsUpdate = true;
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    this.sceneGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }
}
