/**
 * A single reusable Keplerian orbit line.
 *
 * Geometry is built ONCE at construction as a unit ellipse (semi-major axis =
 * `semiMajorBase`, eccentricity `e`, orbit centre offset from the focus by
 * `e·semiMajorBase`) and reused every frame; toggling visibility / highlight /
 * opacity or scaling to a new semi-major axis touches only material / scale
 * state. This satisfies the "no per-frame object creation" performance rule.
 */
import * as THREE from "three";
import { ORBIT_SEGMENTS } from "../config/constants";

const HIGHLIGHT_COLOR = "#ffd54f";

export class OrbitLine {
  readonly line: THREE.Line;
  readonly kind: "planet" | "moon";
  readonly baseSemiMajor: number;
  readonly baseOpacity: number;

  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.LineBasicMaterial;
  private readonly baseColor: string;

  constructor(
    semiMajorBase: number,
    eccentricity: number,
    color: string,
    opacity: number,
    kind: "planet" | "moon" = "planet",
  ) {
    this.baseSemiMajor = semiMajorBase;
    this.baseOpacity = opacity;
    this.kind = kind;
    this.baseColor = color;

    // Ellipse in the XZ (reference) plane, focus at the parent's origin (0,0,0):
    //   centerX = e·a  (Sun sits at one focus; offset makes eccentricity obvious)
    //   semi-minor = a·sqrt(1 - e²)
    const e = eccentricity;
    const centerX = e * semiMajorBase;
    const semiMinor = semiMajorBase * Math.sqrt(Math.max(0, 1 - e * e));

    this.geometry = new THREE.BufferGeometry();
    const positions = new Float32Array((ORBIT_SEGMENTS + 1) * 3);
    for (let i = 0; i <= ORBIT_SEGMENTS; i += 1) {
      const theta = (i / ORBIT_SEGMENTS) * TAU;
      positions[i * 3 + 0] = centerX + semiMajorBase * Math.cos(theta);
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = semiMinor * Math.sin(theta);
    }
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    this.material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });

    this.line = new THREE.Line(this.geometry, this.material);
    this.line.frustumCulled = false;
  }

  /** Tilt the orbital plane about its line of nodes (+X) by inclination. */
  setInclinationDeg(deg: number): void {
    this.line.rotation.x = THREE.MathUtils.degToRad(deg);
  }

  setHighlighted(highlighted: boolean): void {
    this.material.color.set(highlighted ? HIGHLIGHT_COLOR : this.baseColor);
  }

  setOpacity(opacity: number): void {
    this.material.opacity = opacity;
  }

  setVisible(visible: boolean): void {
    this.line.visible = false !== visible;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

const TAU = Math.PI * 2;
