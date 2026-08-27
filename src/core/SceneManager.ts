/**
 * Owns the Three.js renderer, camera, OrbitControls and the CSS2D overlay
 * renderer, plus the resize and dispose contracts every render module relies
 * on. It renders whatever modules have added to `this.scene`.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { MAX_PIXEL_RATIO, INITIAL_CAMERA_POSITION } from "../config/constants";

export class SceneManager {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  readonly controls: OrbitControls;

  private readonly container: HTMLElement;
  private readonly resizeObserver?: ResizeObserver;
  private disposed = false;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04060c);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
    this.camera.position.set(
      INITIAL_CAMERA_POSITION.x,
      INITIAL_CAMERA_POSITION.y,
      INITIAL_CAMERA_POSITION.z,
    );
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.domElement.style.display = "block";
    this.container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    const labelDom = this.labelRenderer.domElement;
    labelDom.style.position = "absolute";
    labelDom.style.top = "0";
    labelDom.style.left = "0";
    labelDom.style.pointerEvents = "none";
    this.container.appendChild(labelDom);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 1200;

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }

    this.resize();
  }

  /** Re-read the container size and update renderers + camera aspect. */
  resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
  }

  /** Convert client coordinates to normalised device coordinates. */
  pointerToNdc(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  /** Render one frame (webgl + css2d overlay). */
  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  isDisposed(): boolean {
    return this.disposed;
  }

  /** Release every GPU/DOM resource this manager created. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.resizeObserver?.disconnect();
    this.controls.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.renderer.dispose();

    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }
}
