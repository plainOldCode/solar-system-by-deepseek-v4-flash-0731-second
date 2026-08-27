/**
 * Composes the full scene from the body index + scale manager: hides the
 * real/render boundary, builds bodies and reusable Keplerian orbit lines,
 * drives motion from accumulated simulation time, and answers raycast
 * selection.
 *
 * Subscribes to settings/selection events so toggles, highlight updates and
 * view-mode opacity do not require App to reach into every object. Nothing is
 * allocated per frame — orbit lines and bodies are built once and mutated.
 */
import * as THREE from "three";
import type { BodyIndex, CelestialBodyData } from "../types";
import { StateStore } from "./StateStore";
import { ScaleManager } from "./ScaleManager";
import { SceneManager } from "./SceneManager";
import { CelestialBody } from "./CelestialBody";
import { OrbitLine } from "./OrbitLine";
import { SUN } from "../data/solarSystemData";

const STAR_MOBILE_BREAKPOINT = 720;
const STARFIELD_RADIUS = 1500;

// Density tiers (mobile reduces count & label density for performance).
const FAINT_STAR_COUNT_DESKTOP = 2600;
const FAINT_STAR_COUNT_MOBILE = 700;
const BRIGHT_STAR_COUNT_DESKTOP = 320;
const BRIGHT_STAR_COUNT_MOBILE = 120;

// Orbit opacity constants for global vs planetary-detail views.
const PLANET_ORBIT_OPACITY = 0.35;
const MOON_ORBIT_OPACITY_DETAIL = 0.2;
const MOON_ORBIT_OPACITY_FAINT = 0.05;
const PLANET_ORBIT_OPACITY_DIM = 0.08;

interface SolarOrbit {
  line: OrbitLine;
  baseRadius: number;
  parent: THREE.Object3D;
}

export class SolarSystem {
  private readonly bodyByData = new Map<string, CelestialBody>();
  private readonly orbitsByBody = new Map<string, SolarOrbit>();
  private readonly selectableRoots: THREE.Object3D[] = [];
  private readonly sunLight: THREE.PointLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly starfieldGroup = new THREE.Group();
  private readonly starfieldLayers: Array<{
    points: THREE.Points;
    geometry: THREE.BufferGeometry;
    material: THREE.PointsMaterial;
  }> = [];
  private readonly raycaster = new THREE.Raycaster();
  private selectedId: string | null = null;
  private disposed = false;

  readonly group = new THREE.Group();

  constructor(
    private readonly index: BodyIndex,
    private readonly scale: ScaleManager,
    private readonly sceneManager: SceneManager,
    private readonly store: StateStore,
  ) {
    this.createSun();

    for (const planet of index.roots) {
      this.createPlanetSystem(planet);
    }

    this.createStarfield();

    // Lighting: illumination originates at the Sun; ambient keeps bodies visible.
    this.ambient = new THREE.AmbientLight(0x404060, 0.5);
    this.sunLight = new THREE.PointLight(0xfff3d6, 2.2, 0, 0);
    this.sunLight.position.set(0, 0, 0);

    this.sceneManager.scene.add(this.group);
    this.sceneManager.scene.add(this.ambient);
    this.sceneManager.scene.add(this.sunLight);

    this.store.on("settings", ({ settings }) => this.applySettings(settings));
    this.store.on("select", ({ id }) => {
      this.selectedId = id;
      this.refreshSceneVisuals();
    });

    this.applySettings(this.store.getSettings());
  }

  private createSun(): CelestialBody {
    const body = new CelestialBody(SUN, true);
    body.setSize(this.scale.sunRadius());
    body.renderDistance = 0;
    body.update(0, 0);
    this.group.add(body.sceneGroup);
    this.bodyByData.set(SUN.id, body);
    this.selectableRoots.push(body.sceneGroup);
    return body;
  }

  private createPlanetSystem(data: CelestialBodyData): void {
    const body = new CelestialBody(data, false);
    this.group.add(body.sceneGroup);
    this.bodyByData.set(data.id, body);
    this.selectableRoots.push(body.sceneGroup);

    // Keplerian elliptical orbit with the body's real eccentricity, tilted by
    // its real inclination around the +X line of nodes.
    const orbit = new OrbitLine(
      100,
      data.eccentricity ?? 0,
      data.displayColor,
      PLANET_ORBIT_OPACITY,
      "planet",
    );
    orbit.setInclinationDeg(data.inclinationDeg ?? 0);
    this.group.add(orbit.line);
    this.orbitsByBody.set(data.id, {
      line: orbit,
      baseRadius: 100,
      parent: this.group,
    });

    // Moons live in the planet's local frame so they move with it.
    const moons = this.index.childrenOf.get(data.id) ?? [];
    const moonDistances = moons
      .map((m) => m.semiMajorAxis ?? 0)
      .filter((v) => v > 0);
    const minKm = moonDistances.length ? Math.min(...moonDistances) : 1;
    const maxKm = moonDistances.length ? Math.max(...moonDistances) : 1;

    for (const moon of moons) {
      const moonBody = new CelestialBody(moon, false);
      body.sceneGroup.add(moonBody.sceneGroup);
      this.bodyByData.set(moon.id, moonBody);

      moonBody.setSize(
        this.scale.mapMoonRadius(moon.radiusKm, this.store.getSettings().sizeMode),
      );
      const norm = this.scale.mapSatelliteDistance(
        moon.semiMajorAxis ?? 0,
        minKm,
        maxKm,
      );
      // Rendered distance (= moon orbit semi-major) = multiple x parent radius.
      moonBody.renderDistance = norm * body.renderRadius;

      const moonOrbit = new OrbitLine(
        50,
        moon.eccentricity ?? 0,
        "#8a97a6",
        MOON_ORBIT_OPACITY_DETAIL,
        "moon",
      );
      moonOrbit.setInclinationDeg(moon.inclinationDeg ?? 0);
      body.sceneGroup.add(moonOrbit.line);
      this.orbitsByBody.set(moon.id, {
        line: moonOrbit,
        baseRadius: 50,
        parent: body.sceneGroup,
      });
    }
  }

  /** Procedural two-tier starfield: faint dense field + sparse bright stars. */
  private createStarfield(): void {
    const isMobile = window.innerWidth <= STAR_MOBILE_BREAKPOINT;
    this.starfieldLayers.push(
      this.makeStarLayer(
        isMobile ? FAINT_STAR_COUNT_MOBILE : FAINT_STAR_COUNT_DESKTOP,
        1.1,
        0.85,
      ),
    );
    this.starfieldLayers.push(
      this.makeStarLayer(
        isMobile ? BRIGHT_STAR_COUNT_MOBILE : BRIGHT_STAR_COUNT_DESKTOP,
        2.4,
        1.0,
      ),
    );
    this.group.add(this.starfieldGroup);
  }

  private makeStarLayer(
    count: number,
    size: number,
    opacity: number,
  ): { points: THREE.Points; geometry: THREE.BufferGeometry; material: THREE.PointsMaterial } {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3 + 0] = STARFIELD_RADIUS * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = STARFIELD_RADIUS * Math.cos(phi);
      positions[i * 3 + 2] = STARFIELD_RADIUS * Math.sin(phi) * Math.sin(theta);
      // Slight colour variance (white / pale blue / warm tint).
      const warm = Math.random();
      if (warm < 0.14) {
        colors[i * 3 + 0] = 0.9;
        colors[i * 3 + 1] = 0.82;
        colors[i * 3 + 2] = 0.65;
      } else if (warm > 0.86) {
        colors[i * 3 + 0] = 0.7;
        colors[i * 3 + 1] = 0.82;
        colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3 + 0] = 1;
        colors[i * 3 + 1] = 1;
        colors[i * 3 + 2] = 1;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    this.starfieldGroup.add(points);
    return { points, geometry, material };
  }

  /**
   * Recompute every body's rendered distance & radius from the active modes.
   * Pure math + line scale updates; no geometry is recreated.
   */
  private applyScales(settings = this.store.getSettings()): void {
    const { distanceMode, sizeMode } = settings;
    for (const planet of this.index.roots) {
      const body = this.bodyByData.get(planet.id)!;
      const smaAU = this.toAU(planet);
      const renderDistance = this.scale.mapHeliocentricDistance(smaAU, distanceMode);
      body.renderDistance = renderDistance;
      body.setSize(this.scale.mapPlanetRadius(planet.radiusKm, sizeMode));
      this.rescaleOrbit(planet.id, renderDistance);

      const moons = this.index.childrenOf.get(planet.id) ?? [];
      const moonKm = moons.map((m) => m.semiMajorAxis ?? 0).filter((v) => v > 0);
      const minKm = moonKm.length ? Math.min(...moonKm) : 1;
      const maxKm = moonKm.length ? Math.max(...moonKm) : 1;
      for (const moon of moons) {
        const mb = this.bodyByData.get(moon.id)!;
        const multiple = this.scale.mapSatelliteDistance(
          moon.semiMajorAxis ?? 0,
          minKm,
          maxKm,
        );
        mb.renderDistance = multiple * body.renderRadius;
        mb.setSize(this.scale.mapMoonRadius(moon.radiusKm, sizeMode));
        this.rescaleOrbit(moon.id, mb.renderDistance);
      }
    }
  }

  private rescaleOrbit(bodyId: string, renderRadius: number): void {
    const entry = this.orbitsByBody.get(bodyId);
    if (!entry) return;
    entry.line.line.scale.setScalar(renderRadius / entry.line.baseSemiMajor);
  }

  private toAU(body: CelestialBodyData): number {
    if (body.semiMajorAxisUnit === "AU") return body.semiMajorAxis ?? 0;
    return (body.semiMajorAxis ?? 0) / 149_597_870;
  }

  private applySettings(settings: ReturnType<StateStore["getSettings"]>): void {
    this.applyScales(settings);

    // Moons (and their labels/system) hide entirely when toggled off.
    for (const planet of this.index.roots) {
      for (const moon of this.index.childrenOf.get(planet.id) ?? []) {
        this.bodyByData.get(moon.id)?.setVisible(settings.showMoons);
      }
    }
    this.starfieldGroup.visible = settings.showStarfield;

    this.refreshSceneVisuals();
  }

  /**
   * Central scene-visuals refresh: orbit visibility / opacity and body
   * emphasis, derived from the active settings, the selected body and the
   * resulting view mode.
   *
   * Global view → planet orbits normal, moon orbits faint.
   * Planetary detail view → selected system's orbits revealed, unrelated
   * planets & orbits dimmed, related bodies emphasized.
   */
  private refreshSceneVisuals(): void {
    const settings = this.store.getSettings();
    const showOrbits = settings.showOrbits;
    const showMoons = settings.showMoons;
    const selData = this.selectedId
      ? this.index.byId.get(this.selectedId)
      : undefined;
    // A non-star selection drives the "planetary-system" detail view.
    const isDetail = !!selData && selData.type !== "star";

    for (const [id, entry] of this.orbitsByBody) {
      const isMoonOrbit = entry.line.kind === "moon";
      const visible = showOrbits && !(isMoonOrbit && !showMoons);
      entry.line.setVisible(visible);
      if (!visible) continue;

      // Highlight the selected body's orbit (and a moon's parent orbit).
      const highlighted =
        id === this.selectedId || id === this.selectedParent(this.selectedId);
      entry.line.setHighlighted(highlighted);

      let opacity = entry.line.baseOpacity;
      if (isMoonOrbit) {
        opacity = isDetail
          ? this.isRelevantMoonOrbit(id, selData)
            ? MOON_ORBIT_OPACITY_DETAIL
            : MOON_ORBIT_OPACITY_FAINT
          : MOON_ORBIT_OPACITY_FAINT;
      } else if (isDetail && id !== this.selectedId && id !== this.selectedParent(this.selectedId)) {
        opacity = PLANET_ORBIT_OPACITY_DIM;
      }
      entry.line.setOpacity(opacity);
    }

    // De-emphasize unrelated planets in the detail view (the Star stays bright).
    for (const planet of this.index.roots) {
      const body = this.bodyByData.get(planet.id);
      if (!body) continue;
      const dim =
        isDetail &&
        planet.id !== this.selectedId &&
        planet.id !== this.selectedParent(this.selectedId);
      body.setEmphasis(dim);
    }
  }

  private isRelevantMoonOrbit(moonId: string, selData: CelestialBodyData | undefined): boolean {
    if (!selData) return false;
    const moon = this.index.byId.get(moonId)!;
    if (selData.type === "planet" || selData.type === "dwarf-planet") {
      return moon.parentId === selData.id;
    }
    // Selected a moon → reveal its own system's moon orbits.
    return moon.parentId === selData.parentId;
  }

  private selectedParent(id: string | null): string | null {
    if (!id) return null;
    const body = this.index.byId.get(id);
    return body?.parentId ?? null;
  }

  /** Advance all bodies by the cumulative simulated time (days). */
  update(elapsedDays: number): void {
    for (const planet of this.index.roots) {
      const pb = this.bodyByData.get(planet.id)!;
      pb.update(elapsedDays, planet.inclinationDeg ?? 0);
      for (const moon of this.index.childrenOf.get(planet.id) ?? []) {
        const mb = this.bodyByData.get(moon.id)!;
        mb.update(elapsedDays, moon.inclinationDeg ?? 0);
      }
    }
  }

  /** Raycast against selectable bodies; returns the nearest body id or null. */
  raycast(ndc: { x: number; y: number }): string | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.sceneManager.camera);
    const hits = this.raycaster.intersectObjects(this.selectableRoots, true);
    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        const id = node.userData.bodyId;
        if (typeof id === "string") return id;
        node = node.parent;
      }
    }
    return null;
  }

  /** Locate a body group (for the camera focus controller). */
  getBody(id: string): CelestialBody | undefined {
    return this.bodyByData.get(id);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const body of this.bodyByData.values()) body.dispose();
    for (const entry of this.orbitsByBody.values()) entry.line.dispose();
    for (const layer of this.starfieldLayers) {
      layer.geometry.dispose();
      layer.material.dispose();
    }
    this.sceneManager.scene.remove(this.group, this.ambient, this.sunLight);
  }
}
