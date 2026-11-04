import type { Borehole, ENZ, PlaneHit, Projected, Section } from '../domain/types'
import { isOnAB, projectWithBasis, sectionBasis } from './section'
import type { SectionBasis } from './section'
import { NUM_TOL } from './tolerance'

const DEG = Math.PI / 180

/** sin/cos derajat yang tepat untuk kelipatan 90° (hindari 6e-17 pada bor vertikal). */
export function sinDeg(d: number): number {
  const r = ((d % 360) + 360) % 360
  if (r === 0 || r === 180) return 0
  if (r === 90) return 1
  if (r === 270) return -1
  return Math.sin(d * DEG)
}

export function cosDeg(d: number): number {
  const r = ((d % 360) + 360) % 360
  if (r === 90 || r === 270) return 0
  if (r === 0) return 1
  if (r === 180) return -1
  return Math.cos(d * DEG)
}

/** Toe lubang lurus: collar + MD·(cos dip·sin az, cos dip·cos az, sin dip). */
export function boreholeToe(hole: Borehole): ENZ {
  const h = hole.md * cosDeg(hole.dipDeg)
  return {
    e: hole.collar.e + h * sinDeg(hole.azDeg),
    n: hole.collar.n + h * cosDeg(hole.azDeg),
    z: hole.collar.z + hole.md * sinDeg(hole.dipDeg),
  }
}

export type BoreholeProjection = {
  collar: Projected
  toe: Projected
  toeWorld: ENZ
  hit: PlaneHit
  /** Proyeksi collar dan toe berimpit pada bidang (s dan z sama). */
  coincident: boolean
}

export function intersectWithBasis(hole: Borehole, k: SectionBasis, tol = NUM_TOL): PlaneHit {
  const toeW = boreholeToe(hole)
  const c = projectWithBasis(hole.collar, k)
  const t = projectWithBasis(toeW, k)
  return classifyHit(hole, c, t, k.L, tol)
}

function classifyHit(hole: Borehole, c: Projected, t: Projected, L: number, tol: number): PlaneHit {
  const cZero = Math.abs(c.o) <= tol
  const tZero = Math.abs(t.o) <= tol
  if (cZero && tZero) {
    const lo = Math.min(c.s, t.s)
    const hi = Math.max(c.s, t.s)
    const inLo = isOnAB(lo, L, tol)
    const inHi = isOnAB(hi, L, tol)
    const overlaps = hi >= -tol && lo <= L + tol
    const abCoverage = inLo && inHi ? 'inside' : overlaps ? 'partial' : 'outside'
    return { kind: 'in-plane', sRange: [lo, hi], abCoverage }
  }
  if (cZero) return { kind: 'touch', md: 0, s: c.s, z: c.z, onAB: isOnAB(c.s, L, tol) }
  if (tZero) return { kind: 'touch', md: hole.md, s: t.s, z: t.z, onAB: isOnAB(t.s, L, tol) }
  if (Math.sign(c.o) !== Math.sign(t.o)) {
    const f = c.o / (c.o - t.o)
    const s = c.s + f * (t.s - c.s)
    return { kind: 'cross', md: f * hole.md, s, z: c.z + f * (t.z - c.z), onAB: isOnAB(s, L, tol) }
  }
  return { kind: 'none' }
}

export function intersectBorehole(hole: Borehole, section: Section): PlaneHit {
  return intersectWithBasis(hole, sectionBasis(section))
}

export function projectBoreholeWithBasis(hole: Borehole, k: SectionBasis, tol = NUM_TOL): BoreholeProjection {
  const toeWorld = boreholeToe(hole)
  const collar = projectWithBasis(hole.collar, k)
  const toe = projectWithBasis(toeWorld, k)
  const hit = classifyHit(hole, collar, toe, k.L, tol)
  const coincident = Math.abs(collar.s - toe.s) <= tol && Math.abs(collar.z - toe.z) <= tol
  return { collar, toe, toeWorld, hit, coincident }
}

export function projectBorehole(hole: Borehole, section: Section): BoreholeProjection {
  return projectBoreholeWithBasis(hole, sectionBasis(section))
}
