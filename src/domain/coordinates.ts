import type { Bounds3, ENZ, XY } from './types'

/**
 * Origin lokal untuk GPU. Koordinat dunia (jutaan meter) dikurangi origin
 * sebelum diubah ke Float32 agar presisi render terjaga.
 */
export type RenderOrigin = { e0: number; n0: number; z0: number }

export function originFromBounds(b: Bounds3): RenderOrigin {
  return {
    e0: (b.min.e + b.max.e) / 2,
    n0: (b.min.n + b.max.n) / 2,
    z0: (b.min.z + b.max.z) / 2,
  }
}

/** Three.js Y ke atas: (E,N,Z) → (E−E0, Z−Z0, −(N−N0)). */
export function worldToRender(p: ENZ, o: RenderOrigin): [number, number, number] {
  return [p.e - o.e0, p.z - o.z0, -(p.n - o.n0)]
}

export function renderToWorld(x: number, y: number, z: number, o: RenderOrigin): ENZ {
  return { e: x + o.e0, n: -z + o.n0, z: y + o.z0 }
}

/**
 * Tampak atas ortografis: utara di atas, timur di kanan.
 * center = titik dunia di tengah viewport; mpp = meter per piksel CSS.
 */
export type TopView = { center: XY; mpp: number; width: number; height: number }

export function screenToWorldTop(v: TopView, px: number, py: number): XY {
  return {
    e: v.center.e + (px - v.width / 2) * v.mpp,
    n: v.center.n - (py - v.height / 2) * v.mpp,
  }
}

export function worldToScreenTop(v: TopView, p: XY): { x: number; y: number } {
  return {
    x: (p.e - v.center.e) / v.mpp + v.width / 2,
    y: -(p.n - v.center.n) / v.mpp + v.height / 2,
  }
}

/** Tampak atas yang memuat seluruh bounds dengan margin relatif. */
export function fitTopView(
  minE: number,
  minN: number,
  maxE: number,
  maxN: number,
  width: number,
  height: number,
  margin = 0.08,
): TopView {
  const w = Math.max(maxE - minE, 1e-3)
  const h = Math.max(maxN - minN, 1e-3)
  const mpp = Math.max(w / Math.max(width, 1), h / Math.max(height, 1)) * (1 + 2 * margin)
  return { center: { e: (minE + maxE) / 2, n: (minN + maxN) / 2 }, mpp, width, height }
}

export function emptyBounds(): Bounds3 {
  return {
    min: { e: Infinity, n: Infinity, z: Infinity },
    max: { e: -Infinity, n: -Infinity, z: -Infinity },
  }
}

export function boundsFromXyz(xyz: Float64Array): Bounds3 {
  const b = emptyBounds()
  for (let i = 0; i + 2 < xyz.length; i += 3) {
    const e = xyz[i]!, n = xyz[i + 1]!, z = xyz[i + 2]!
    if (e < b.min.e) b.min.e = e
    if (n < b.min.n) b.min.n = n
    if (z < b.min.z) b.min.z = z
    if (e > b.max.e) b.max.e = e
    if (n > b.max.n) b.max.n = n
    if (z > b.max.z) b.max.z = z
  }
  return b
}
