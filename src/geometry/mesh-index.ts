import type { Mesh, XY } from '../domain/types'
import { NUM_TOL } from './tolerance'

/**
 * Indeks grid seragam atas bounding box segitiga pada bidang E/N.
 * Dibangun sekali per surface; dipakai ulang untuk setiap perubahan A/B.
 */
export type MeshIndex = {
  minE: number
  minN: number
  cell: number
  nx: number
  ny: number
  /** CSR: item sel c berada di cellItems[cellStart[c] .. cellStart[c+1]). */
  cellStart: Uint32Array
  cellItems: Uint32Array
  /** Per segitiga: minE, minN, maxE, maxN. */
  triBox: Float64Array
  /** 1 = dipakai untuk profil 2.5D; 0 = vertikal/degenerat/non-finite. */
  usable: Uint8Array
  excludedCount: number
  triangleCount: number
  /** Penanda kunjungan untuk deduplikasi kandidat per query. */
  stamp: Uint32Array
  stampValue: number
}

const MAX_CELLS = 4_000_000

/** Apakah segitiga dapat dipakai untuk profil 2.5D (finite, luas proyeksi horizontal > 0). */
export function triangleUsable(xyz: Float64Array, i0: number, i1: number, i2: number, tol = NUM_TOL): boolean {
  const ax = xyz[i0 * 3]!, ay = xyz[i0 * 3 + 1]!, az = xyz[i0 * 3 + 2]!
  const bx = xyz[i1 * 3]!, by = xyz[i1 * 3 + 1]!, bz = xyz[i1 * 3 + 2]!
  const cx = xyz[i2 * 3]!, cy = xyz[i2 * 3 + 1]!, cz = xyz[i2 * 3 + 2]!
  if (![ax, ay, az, bx, by, bz, cx, cy, cz].every(Number.isFinite)) return false
  const ux = bx - ax, uy = by - ay, vx = cx - ax, vy = cy - ay
  const cross = ux * vy - uy * vx
  const maxEdge = Math.max(Math.hypot(ux, uy), Math.hypot(vx, vy), Math.hypot(cx - bx, cy - by))
  return maxEdge > tol && Math.abs(cross) / maxEdge > tol
}

export function buildMeshIndex(mesh: Mesh): MeshIndex {
  const { xyz, triangles } = mesh
  const nT = Math.floor(triangles.length / 3)
  const nV = Math.floor(xyz.length / 3)
  const triBox = new Float64Array(nT * 4)
  const usable = new Uint8Array(nT)
  let minE = Infinity, minN = Infinity, maxE = -Infinity, maxN = -Infinity
  let excluded = 0
  for (let t = 0; t < nT; t++) {
    const i0 = triangles[t * 3]!, i1 = triangles[t * 3 + 1]!, i2 = triangles[t * 3 + 2]!
    if (i0 >= nV || i1 >= nV || i2 >= nV || !triangleUsable(xyz, i0, i1, i2)) {
      excluded++
      continue
    }
    usable[t] = 1
    const e0 = xyz[i0 * 3]!, e1 = xyz[i1 * 3]!, e2 = xyz[i2 * 3]!
    const n0 = xyz[i0 * 3 + 1]!, n1 = xyz[i1 * 3 + 1]!, n2 = xyz[i2 * 3 + 1]!
    const bMinE = Math.min(e0, e1, e2), bMaxE = Math.max(e0, e1, e2)
    const bMinN = Math.min(n0, n1, n2), bMaxN = Math.max(n0, n1, n2)
    triBox[t * 4] = bMinE
    triBox[t * 4 + 1] = bMinN
    triBox[t * 4 + 2] = bMaxE
    triBox[t * 4 + 3] = bMaxN
    if (bMinE < minE) minE = bMinE
    if (bMinN < minN) minN = bMinN
    if (bMaxE > maxE) maxE = bMaxE
    if (bMaxN > maxN) maxN = bMaxN
  }
  const nUsable = nT - excluded
  if (nUsable === 0) {
    return {
      minE: 0, minN: 0, cell: 1, nx: 0, ny: 0,
      cellStart: new Uint32Array(1), cellItems: new Uint32Array(0),
      triBox, usable, excludedCount: excluded, triangleCount: nT,
      stamp: new Uint32Array(nT), stampValue: 0,
    }
  }
  const w = Math.max(maxE - minE, 1e-3)
  const h = Math.max(maxN - minN, 1e-3)
  // Sekitar 2 segitiga per sel.
  let cell = Math.sqrt((w * h) / Math.max(nUsable / 2, 1))
  let nx = Math.max(1, Math.ceil(w / cell))
  let ny = Math.max(1, Math.ceil(h / cell))
  while (nx * ny > MAX_CELLS) {
    cell *= 1.5
    nx = Math.max(1, Math.ceil(w / cell))
    ny = Math.max(1, Math.ceil(h / cell))
  }
  const col = (e: number) => Math.min(nx - 1, Math.max(0, Math.floor((e - minE) / cell)))
  const row = (n: number) => Math.min(ny - 1, Math.max(0, Math.floor((n - minN) / cell)))
  const counts = new Uint32Array(nx * ny + 1)
  for (let t = 0; t < nT; t++) {
    if (!usable[t]) continue
    const c0 = col(triBox[t * 4]!), c1 = col(triBox[t * 4 + 2]!)
    const r0 = row(triBox[t * 4 + 1]!), r1 = row(triBox[t * 4 + 3]!)
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) counts[r * nx + c + 1]!++
  }
  for (let i = 1; i < counts.length; i++) counts[i]! += counts[i - 1]!
  const cellStart = counts
  const cellItems = new Uint32Array(cellStart[nx * ny]!)
  const fill = cellStart.slice(0, nx * ny)
  for (let t = 0; t < nT; t++) {
    if (!usable[t]) continue
    const c0 = col(triBox[t * 4]!), c1 = col(triBox[t * 4 + 2]!)
    const r0 = row(triBox[t * 4 + 1]!), r1 = row(triBox[t * 4 + 3]!)
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) cellItems[fill[r * nx + c]!++] = t
  }
  return {
    minE, minN, cell, nx, ny, cellStart, cellItems, triBox, usable,
    excludedCount: excluded, triangleCount: nT, stamp: new Uint32Array(nT), stampValue: 0,
  }
}

/**
 * Kandidat segitiga yang bounding box-nya mungkin bersinggungan dengan segmen A–B
 * (diperluas toleransi). Hanya sel yang dilalui segmen yang dikunjungi.
 */
export function queryCandidates(index: MeshIndex, a: XY, b: XY, tol = NUM_TOL): number[] {
  const out: number[] = []
  if (index.nx === 0) return out
  index.stampValue = (index.stampValue + 1) >>> 0
  if (index.stampValue === 0) {
    index.stamp.fill(0)
    index.stampValue = 1
  }
  const sv = index.stampValue
  const { minE, minN, cell, nx, ny } = index
  const gMaxE = minE + nx * cell
  const gMaxN = minN + ny * cell
  const segMinE = Math.min(a.e, b.e) - tol, segMaxE = Math.max(a.e, b.e) + tol
  const e0 = Math.max(segMinE, minE), e1 = Math.min(segMaxE, gMaxE)
  if (e0 > e1) return out
  const dE = b.e - a.e
  const dN = b.n - a.n
  const c0 = Math.min(nx - 1, Math.max(0, Math.floor((e0 - minE) / cell)))
  const c1 = Math.min(nx - 1, Math.max(0, Math.floor((e1 - minE) / cell)))
  const nAt = (e: number) => a.n + ((e - a.e) / dE) * dN
  for (let c = c0; c <= c1; c++) {
    const xL = Math.max(minE + c * cell, e0)
    const xR = Math.min(minE + (c + 1) * cell, e1)
    let nLo: number, nHi: number
    if (Math.abs(dE) <= 1e-12 * Math.max(1, Math.abs(dN))) {
      nLo = Math.min(a.n, b.n)
      nHi = Math.max(a.n, b.n)
    } else {
      const nA = nAt(Math.min(Math.max(xL, Math.min(a.e, b.e)), Math.max(a.e, b.e)))
      const nB = nAt(Math.min(Math.max(xR, Math.min(a.e, b.e)), Math.max(a.e, b.e)))
      nLo = Math.min(nA, nB)
      nHi = Math.max(nA, nB)
    }
    nLo = Math.max(nLo - tol, minN)
    nHi = Math.min(nHi + tol, gMaxN)
    if (nLo > nHi) continue
    const r0 = Math.min(ny - 1, Math.max(0, Math.floor((nLo - minN) / cell)))
    const r1 = Math.min(ny - 1, Math.max(0, Math.floor((nHi - minN) / cell)))
    for (let r = r0; r <= r1; r++) {
      const k = r * nx + c
      for (let j = index.cellStart[k]!; j < index.cellStart[k + 1]!; j++) {
        const t = index.cellItems[j]!
        if (index.stamp[t] === sv) continue
        index.stamp[t] = sv
        const bx = t * 4
        if (index.triBox[bx]! > segMaxE || index.triBox[bx + 2]! < segMinE) continue
        if (index.triBox[bx + 1]! > Math.max(a.n, b.n) + tol || index.triBox[bx + 3]! < Math.min(a.n, b.n) - tol) continue
        out.push(t)
      }
    }
  }
  return out
}
