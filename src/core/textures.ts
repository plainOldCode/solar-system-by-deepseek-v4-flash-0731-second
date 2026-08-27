/**
 * Procedural surface textures (CanvasTexture) — no external assets.
 *
 * Every texture is generated at runtime onto a 2D canvas and wrapped in a
 * THREE.CanvasTexture. Deterministic per-body via an id-seeded PRNG so the
 * same body always looks the same. Textures are created once during body
 * construction and disposed with the body; nothing is allocated per frame.
 */
import * as THREE from "three";
import type { BodyType } from "../types";

const SIZE = 512;
const TAU = Math.PI * 2;

/** Deterministic 32-bit string hash (FNV-1a) for stable per-body seeds. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG seeded from the body id (deterministic across frames). */
function seededRandom(seedStr: string): () => number {
  let a = hashString(seedStr);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(rgb: [number, number, number], f: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(rgb[0])},${c(rgb[1])},${c(rgb[2])})`;
}

function isGasGiant(id: string): boolean {
  return /jupiter|saturn|uranus|neptune/.test(id);
}

function isEarth(id: string): boolean {
  return /\.earth\./.test(id);
}

/** Build the canvas pixels for a planet's surface map. */
function paintPlanet(
  ctx: CanvasRenderingContext2D,
  id: string,
  base: string,
): void {
  const rgb = hexToRgb(base);
  const rnd = seededRandom(id);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  if (isGasGiant(id)) {
    // Horizontal atmospheric bands with soft edges.
    const bands = 5 + Math.floor(rnd() * 4);
    for (let b = 0; b < bands; b += 1) {
      const y = rnd() * SIZE;
      const h = 18 + rnd() * 70;
      const factor = 0.82 + rnd() * 0.5;
      const grad = ctx.createLinearGradient(0, y - h, 0, y + h);
      grad.addColorStop(0, shade(rgb, factor));
      grad.addColorStop(0.5, shade(rgb, factor * 1.15));
      grad.addColorStop(1, shade(rgb, factor));
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - h, SIZE, h * 2);
    }
    // Occasional elliptical storm spots.
    const spots = 2 + Math.floor(rnd() * 3);
    for (let s = 0; s < spots; s += 1) {
      ctx.fillStyle = shade(rgb, 0.75);
      ctx.beginPath();
      ctx.ellipse(
        rnd() * SIZE,
        rnd() * SIZE,
        14 + rnd() * 34,
        6 + rnd() * 12,
        0,
        0,
        TAU,
      );
      ctx.fill();
    }
    return;
  }

  if (isEarth(id)) {
    // Blue ocean base with green-brown continent patches and polar caps.
    for (let i = 0; i < 90; i += 1) {
      const cx = rnd() * SIZE;
      const cy = rnd() * SIZE;
      const r = 6 + rnd() * 26;
      const isLand = rnd() < 0.42;
      ctx.fillStyle = isLand
        ? `rgba(46,${110 + Math.round(rnd() * 60)},58,0.9)`
        : `rgba(20,${90 + Math.round(rnd() * 60)},160,0.12)`;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.fill();
    }
    if (rnd() < 1) {
      ctx.fillStyle = "rgba(235,240,245,0.95)";
      ctx.fillRect(0, 0, SIZE, 22);
      ctx.fillRect(0, SIZE - 22, SIZE, 22);
    }
    return;
  }

  // Rocky / icy worlds: subtle mottling in shades of the base colour.
  const patches = 180 + Math.floor(rnd() * 140);
  for (let i = 0; i < patches; i += 1) {
    const x = rnd() * SIZE;
    const y = rnd() * SIZE;
    const r = 2 + rnd() * 16;
    ctx.fillStyle = shade(rgb, 0.82 + rnd() * 0.4);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

/**
 * Build a procedural surface texture for a body, or null for bodies that
 * should stay a plain solid colour (the Sun, and moons).
 */
export function makeSurfaceTexture(
  id: string,
  type: BodyType,
  color: string,
): THREE.CanvasTexture | null {
  if (type === "star" || type === "moon") return null;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  paintPlanet(ctx, id, color);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Radial-gradient band texture for ring meshes (Saturn-style). */
export function makeRingTexture(base: string): THREE.CanvasTexture {
  const w = 512;
  const h = 8;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const rgb = hexToRgb(base);
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 8; i += 1) {
      const f = 0.55 + (i % 2 === 0 ? 0.05 : 0.32) + (i / 8) * 0.1;
      grad.addColorStop(i / 8, shade(rgb, f));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}
