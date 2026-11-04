import type { Borehole, NamedPoint, PlaneHit, Projected, Section } from './types'
import { intervalInCorridor, isOnAB, pointInCorridor, projectWithBasis, sectionBasis } from '../geometry/section'
import { projectBoreholeWithBasis } from '../geometry/borehole'

export type Corridor = { enabled: boolean; halfWidth: number }

export type PointRow = {
  kind: 'point'
  id: string
  name: string
  p: Projected
  onAB: boolean
  visible: boolean
}

export type BoreholeRow = {
  kind: 'borehole'
  id: string
  name: string
  collar: Projected
  toe: Projected
  md: number
  hit: PlaneHit
  coincident: boolean
  collarOnAB: boolean
  toeOnAB: boolean
  visible: boolean
}

export type ObjectRow = PointRow | BoreholeRow

export type SectionObjects = {
  L: number
  rows: ObjectRow[]
  validCount: number
  shownCount: number
  /** Rentang s dan z yang memuat seluruh objek yang ditampilkan. */
  extent: { sMin: number; sMax: number; zMin: number; zMax: number } | null
}

/** Proyeksi seluruh objek aktif. Default filter mati: semua objek valid ditampilkan. */
export function projectObjects(points: NamedPoint[], holes: Borehole[], section: Section, corridor: Corridor): SectionObjects {
  const k = sectionBasis(section)
  const rows: ObjectRow[] = []
  let sMin = Infinity, sMax = -Infinity, zMin = Infinity, zMax = -Infinity
  const grow = (s: number, z: number) => {
    if (s < sMin) sMin = s
    if (s > sMax) sMax = s
    if (z < zMin) zMin = z
    if (z > zMax) zMax = z
  }
  for (const pt of points) {
    const p = projectWithBasis(pt, k)
    const visible = !corridor.enabled || pointInCorridor(p.o, corridor.halfWidth)
    rows.push({ kind: 'point', id: pt.id, name: pt.name, p, onAB: isOnAB(p.s, k.L), visible })
    if (visible) grow(p.s, p.z)
  }
  for (const h of holes) {
    const r = projectBoreholeWithBasis(h, k)
    const visible = !corridor.enabled || intervalInCorridor(r.collar.o, r.toe.o, corridor.halfWidth)
    rows.push({
      kind: 'borehole', id: h.id, name: h.name, collar: r.collar, toe: r.toe, md: h.md, hit: r.hit,
      coincident: r.coincident, collarOnAB: isOnAB(r.collar.s, k.L), toeOnAB: isOnAB(r.toe.s, k.L), visible,
    })
    if (visible) {
      grow(r.collar.s, r.collar.z)
      grow(r.toe.s, r.toe.z)
    }
  }
  const shownCount = rows.filter((r) => r.visible).length
  return {
    L: k.L,
    rows,
    validCount: rows.length,
    shownCount,
    extent: shownCount ? { sMin, sMax, zMin, zMax } : null,
  }
}
