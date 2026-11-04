import type { Bounds3, ENZ, IssueLocation, Mesh, ValidationIssue } from '../domain/types'
import { boundsFromXyz } from '../domain/coordinates'
import { NUM_TOL } from '../geometry/tolerance'

/** Batas jumlah issue yang disimpan per kode; sisanya hanya dihitung. */
export const MAX_ISSUES_PER_CODE = 50

export class IssueCollector {
  readonly list: ValidationIssue[] = []
  readonly counts: Record<string, number> = {}
  add(issue: ValidationIssue) {
    const n = (this.counts[issue.code] ?? 0) + 1
    this.counts[issue.code] = n
    if (n <= MAX_ISSUES_PER_CODE) this.list.push(issue)
  }
  has(code: string) {
    return (this.counts[code] ?? 0) > 0
  }
}

export type BuiltMesh = {
  mesh: Mesh
  bounds: Bounds3
  /** ID sumber per segitiga (handle DXF atau nomor muka). */
  faceIds: string[]
  rejectedFaces: number
  /** Segitiga dengan luas proyeksi horizontal ≈ 0 (dikeluarkan dari profil 2.5D). */
  verticalFaces: number
}

/**
 * Mengumpulkan segitiga berkoordinat dunia, menyatukan vertex yang identik secara
 * geometris, menolak muka rusak, dan mengarahkan segitiga CCW di bidang E/N.
 */
export class MeshBuilder {
  private readonly xyz: number[] = []
  private readonly tri: number[] = []
  private readonly keyToIndex = new Map<string, number>()
  readonly faceIds: string[] = []
  rejectedFaces = 0
  verticalFaces = 0
  private readonly issues: IssueCollector
  private readonly tol: number

  constructor(issues: IssueCollector, tol = NUM_TOL) {
    this.issues = issues
    this.tol = tol
  }

  reject(code: string, message: string, location: IssueLocation) {
    this.rejectedFaces++
    this.issues.add({ code, severity: 'warning', message, location })
  }

  private vertex(p: ENZ): number {
    const key = `${p.e},${p.n},${p.z}`
    let i = this.keyToIndex.get(key)
    if (i === undefined) {
      i = this.xyz.length / 3
      this.xyz.push(p.e, p.n, p.z)
      this.keyToIndex.set(key, i)
    }
    return i
  }

  /** Mengembalikan true bila segitiga diterima. */
  addTriangle(a: ENZ, b: ENZ, c: ENZ, faceId: string, location: IssueLocation): boolean {
    for (const p of [a, b, c]) {
      if (!Number.isFinite(p.e) || !Number.isFinite(p.n) || !Number.isFinite(p.z)) {
        this.reject('FACE_NONFINITE', `Muka ${faceId} memiliki koordinat bukan angka; muka dikeluarkan.`, location)
        return false
      }
    }
    // Koordinat lokal relatif a agar presisi tetap pada koordinat jutaan meter.
    const ux = b.e - a.e, uy = b.n - a.n, uz = b.z - a.z
    const vx = c.e - a.e, vy = c.n - a.n, vz = c.z - a.z
    const cx = uy * vz - uz * vy
    const cy = uz * vx - ux * vz
    const cz = ux * vy - uy * vx
    const area2 = Math.hypot(cx, cy, cz)
    const maxEdge = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(c.e - b.e, c.n - b.n, c.z - b.z))
    if (maxEdge <= this.tol || area2 / maxEdge <= this.tol) {
      this.reject('FACE_DEGENERATE', `Muka ${faceId} degenerat (vertex berulang atau segaris); muka dikeluarkan.`, location)
      return false
    }
    const maxEdgeXY = Math.max(Math.hypot(ux, uy), Math.hypot(vx, vy), Math.hypot(c.e - b.e, c.n - b.n))
    const vertical = maxEdgeXY <= this.tol || Math.abs(cz) / maxEdgeXY <= this.tol
    if (vertical) {
      this.verticalFaces++
      this.issues.add({
        code: 'FACE_VERTICAL',
        severity: 'warning',
        message: `Muka ${faceId} vertikal (luas proyeksi horizontal nol); tidak dipakai pada profil topografi 2.5D.`,
        location,
      })
    }
    const ia = this.vertex(a)
    let ib = this.vertex(b)
    let ic = this.vertex(c)
    if (cz < 0) [ib, ic] = [ic, ib]
    this.tri.push(ia, ib, ic)
    this.faceIds.push(faceId)
    return true
  }

  get triangleCount() {
    return this.tri.length / 3
  }

  build(): BuiltMesh {
    const xyz = Float64Array.from(this.xyz)
    return {
      mesh: { xyz, triangles: Uint32Array.from(this.tri) },
      bounds: boundsFromXyz(xyz),
      faceIds: this.faceIds,
      rejectedFaces: this.rejectedFaces,
      verticalFaces: this.verticalFaces,
    }
  }
}

/** Peringatan batas koordinat mencurigakan (tanpa menebak EPSG atau menukar E/N). */
export function coordinateSanityIssues(b: Bounds3, file: string): ValidationIssue[] {
  const out: ValidationIssue[] = []
  const ext = Math.max(b.max.e - b.min.e, b.max.n - b.min.n)
  const absMax = Math.max(Math.abs(b.min.e), Math.abs(b.max.e), Math.abs(b.min.n), Math.abs(b.max.n))
  if (ext > 200_000 || absMax > 50_000_000 || Math.abs(b.max.z) > 20_000 || Math.abs(b.min.z) > 20_000) {
    out.push({
      code: 'COORD_SUSPICIOUS',
      severity: 'warning',
      message:
        'Batas koordinat tidak lazim untuk satu surface dalam meter (cakupan atau nilai sangat besar). Periksa unit, datum, dan susunan E/N.',
      location: { file },
    })
  }
  return out
}
