import type { Mesh, Profile, ProfileVertex, Section } from '../domain/types'
import type { MeshIndex } from './mesh-index'
import { queryCandidates } from './mesh-index'
import { sectionBasis } from './section'
import { NUM_TOL } from './tolerance'

/** Toleransi kesamaan Z antar segitiga pada chainage yang sama (m). */
export const Z_TOL = 1e-5
/** Jarak di mana sentuhan tunggal dianggap bagian dari interval yang sudah ada (m). */
const TOUCH_NEAR = 1e-4

type Hit = {
  s0: number
  s1: number
  tri: number
  /** Bidang lokal: z = pz + gx·x + gy·y (x,y relatif A). */
  pz: number
  gx: number
  gy: number
}

export type SliceStats = { candidates: number; intervals: number; touches: number; excludedFaces: number }

/**
 * Klip segmen horizontal A–B terhadap segitiga di bidang E/N (Cyrus–Beck).
 * Koordinat lokal relatif A. `tol` memperlonggar setiap tepi sejauh tol (m).
 * Tepi yang berimpit dengan garis (dalam tol) tidak membatasi.
 */
function clip(
  px: Float64Array,
  py: Float64Array,
  uE: number,
  uN: number,
  L: number,
  tol: number,
  collinearTol: number,
): [number, number] | null {
  const area = (px[1]! - px[0]!) * (py[2]! - py[0]!) - (py[1]! - py[0]!) * (px[2]! - px[0]!)
  const sign = area > 0 ? 1 : -1
  let lo = 0
  let hi = L
  for (let k = 0; k < 3; k++) {
    const i = k, j = (k + 1) % 3
    const ex = px[j]! - px[i]!, ey = py[j]! - py[i]!
    const len = Math.hypot(ex, ey)
    // jarak bertanda ke dalam: d(s) = d0 + s·kk
    const d0 = (sign * (ex * (0 - py[i]!) - ey * (0 - px[i]!))) / len
    const kk = (sign * (ex * uN - ey * uE)) / len
    if (Math.abs(kk) <= 1e-12) {
      if (d0 < -collinearTol) return null
      continue
    }
    const sb = (-tol - d0) / kk
    if (kk > 0) {
      if (sb > lo) lo = sb
    } else if (sb < hi) hi = sb
    if (lo > hi) return null
  }
  return [lo, hi]
}

/**
 * Penampang TIN dari segitiga asli sepanjang 0 ≤ s ≤ L.
 * Mempertahankan patahan bench dan celah, memecah profil pada rentang ambigu.
 */
export function sliceSurface(mesh: Mesh, index: MeshIndex, section: Section, stats?: SliceStats): Profile {
  const k = sectionBasis(section)
  const { a, uE, uN, L } = k
  const cands = queryCandidates(index, k.a, k.b)
  const { xyz, triangles } = mesh
  const px = new Float64Array(3)
  const py = new Float64Array(3)
  const pzv = new Float64Array(3)
  const hits: Hit[] = []
  const touches: { s: number; z: number; tri: number }[] = []

  for (const t of cands) {
    if (!index.usable[t]) continue
    for (let v = 0; v < 3; v++) {
      const vi = triangles[t * 3 + v]! * 3
      px[v] = xyz[vi]! - a.e
      py[v] = xyz[vi + 1]! - a.n
      pzv[v] = xyz[vi + 2]!
    }
    // Bidang segitiga (gradien) dalam koordinat lokal.
    const x1 = px[1]! - px[0]!, y1 = py[1]! - py[0]!, z1 = pzv[1]! - pzv[0]!
    const x2 = px[2]! - px[0]!, y2 = py[2]! - py[0]!, z2 = pzv[2]! - pzv[0]!
    const det = x1 * y2 - x2 * y1
    const gx = (z1 * y2 - z2 * y1) / det
    const gy = (x1 * z2 - x2 * z1) / det
    const pz = pzv[0]! - gx * px[0]! - gy * py[0]!
    const exact = clip(px, py, uE, uN, L, 0, NUM_TOL)
    if (exact && exact[1] - exact[0] > NUM_TOL) {
      hits.push({ s0: exact[0], s1: exact[1], tri: t, pz, gx, gy })
      continue
    }
    const loose = clip(px, py, uE, uN, L, NUM_TOL, NUM_TOL)
    if (loose) {
      const s = Math.min(L, Math.max(0, (loose[0] + loose[1]) / 2))
      touches.push({ s, z: pz + gx * s * uE + gy * s * uN, tri: t })
    }
  }
  if (stats) {
    stats.candidates = cands.length
    stats.intervals = hits.length
    stats.touches = touches.length
    stats.excludedFaces = index.excludedCount
  }

  const zAt = (h: Hit, s: number) => h.pz + h.gx * s * uE + h.gy * s * uN

  // Titik patah gabungan (dikelompokkan dalam toleransi numerik).
  const raw: number[] = []
  for (const h of hits) raw.push(h.s0, h.s1)
  raw.sort((p, q) => p - q)
  const bps: number[] = []
  for (const v of raw) if (bps.length === 0 || v - bps[bps.length - 1]! > NUM_TOL) bps.push(v)

  hits.sort((p, q) => p.s0 - q.s0)
  const parts: ProfileVertex[][] = []
  const ambiguous: [number, number][] = []
  const ambiguousFaces: number[][] = []
  const covered: [number, number][] = []
  let cur: ProfileVertex[] | null = null
  let prevRight: { s: number; z: number } | null = null
  let active: Hit[] = []
  let next = 0

  const closePart = () => {
    if (cur && cur.length > 0) parts.push(cur)
    cur = null
    prevRight = null
  }

  for (let i = 0; i + 1 < bps.length; i++) {
    const b0 = bps[i]!, b1 = bps[i + 1]!
    const mid = (b0 + b1) / 2
    while (next < hits.length && hits[next]!.s0 <= mid) active.push(hits[next++]!)
    active = active.filter((h) => h.s1 >= mid)
    const cover = active.filter((h) => h.s0 <= mid)
    if (cover.length === 0) {
      closePart()
      continue
    }
    let zmin = Infinity, zmax = -Infinity
    for (const h of cover) {
      const z = zAt(h, mid)
      if (z < zmin) zmin = z
      if (z > zmax) zmax = z
    }
    covered.push([b0, b1])
    if (zmax - zmin > Z_TOL) {
      closePart()
      const last = ambiguous[ambiguous.length - 1]
      const faces = [...new Set(cover.map((h) => h.tri))].sort((p, q) => p - q)
      if (last && Math.abs(last[1] - b0) <= NUM_TOL) {
        last[1] = b1
        const lf = ambiguousFaces[ambiguousFaces.length - 1]!
        for (const f of faces) if (!lf.includes(f)) lf.push(f)
      } else {
        ambiguous.push([b0, b1])
        ambiguousFaces.push(faces)
      }
      continue
    }
    const h = cover[0]!
    const zL = zAt(h, b0)
    const zR = zAt(h, b1)
    const pr = prevRight as { s: number; z: number } | null
    if (cur && pr && Math.abs(pr.s - b0) <= NUM_TOL && Math.abs(pr.z - zL) <= Z_TOL) {
      cur.push({ s: b1, z: zR })
    } else {
      closePart()
      cur = [{ s: b0, z: zL }, { s: b1, z: zR }]
    }
    prevRight = { s: b1, z: zR }
  }
  closePart()

  // Hapus vertex kolinear berurutan agar profil ringkas (tanpa mengubah bentuk).
  for (const p of parts) simplifyCollinear(p)

  // Sentuhan tunggal yang tidak berada di interval terisi menjadi marker.
  const markers: ProfileVertex[] = []
  for (const t of touches.sort((p, q) => p.s - q.s)) {
    const near = covered.some(([s0, s1]) => t.s >= s0 - TOUCH_NEAR && t.s <= s1 + TOUCH_NEAR)
    if (near) continue
    if (markers.some((m) => Math.abs(m.s - t.s) <= TOUCH_NEAR)) continue
    markers.push({ s: t.s, z: t.z })
  }
  for (const m of markers) parts.push([m])
  parts.sort((p, q) => p[0]!.s - q[0]!.s)

  return ambiguous.length > 0 ? { parts, ambiguous, ambiguousFaces } : { parts, ambiguous }
}

function simplifyCollinear(p: ProfileVertex[]) {
  if (p.length < 3) return
  const out: ProfileVertex[] = [p[0]!]
  for (let i = 1; i < p.length - 1; i++) {
    const a = out[out.length - 1]!, b = p[i]!, c = p[i + 1]!
    const slope1 = (b.z - a.z) / (b.s - a.s)
    const slope2 = (c.z - b.z) / (c.s - b.s)
    if (Math.abs(slope1 - slope2) * Math.max(c.s - a.s, 1) > Z_TOL) out.push(b)
  }
  out.push(p[p.length - 1]!)
  p.length = 0
  p.push(...out)
}

/** Interpolasi Z profil pada chainage s; null bila s berada di celah. */
export function profileZAt(profile: Profile, s: number, tol = NUM_TOL): number | null {
  for (const part of profile.parts) {
    if (part.length === 1) {
      if (Math.abs(part[0]!.s - s) <= tol) return part[0]!.z
      continue
    }
    for (let i = 0; i + 1 < part.length; i++) {
      const p = part[i]!, q = part[i + 1]!
      if (s >= p.s - tol && s <= q.s + tol) {
        const f = q.s === p.s ? 0 : (s - p.s) / (q.s - p.s)
        return p.z + Math.min(1, Math.max(0, f)) * (q.z - p.z)
      }
    }
  }
  return null
}
