import type { ENZ, Projected, Section, ValidationIssue, XY } from '../domain/types'
import { NUM_TOL } from './tolerance'

export type SectionBasis = {
  a: XY
  b: XY
  /** Panjang horizontal A–B (m). */
  L: number
  uE: number
  uN: number
}

export class DegenerateSectionError extends Error {
  readonly issue: ValidationIssue
  constructor(issue: ValidationIssue) {
    super(issue.message)
    this.name = 'DegenerateSectionError'
    this.issue = issue
  }
}

/** Mengembalikan masalah bila garis A–B tidak dapat dipakai, atau null bila sah. */
export function validateSection(section: Section, tol = NUM_TOL): ValidationIssue | null {
  const { a, b } = section
  if (![a.e, a.n, b.e, b.n].every(Number.isFinite)) {
    return {
      code: 'SECTION_NOT_FINITE',
      severity: 'error',
      message: 'Koordinat A atau B tidak valid. Isi Easting dan Northing berupa angka.',
    }
  }
  const L = Math.hypot(b.e - a.e, b.n - a.n)
  if (L <= tol) {
    return {
      code: 'SECTION_ZERO_LENGTH',
      severity: 'error',
      message: 'Titik A dan B berimpit sehingga arah penampang tidak terdefinisi. Pindahkan B menjauhi A.',
    }
  }
  return null
}

export function sectionBasis(section: Section, tol = NUM_TOL): SectionBasis {
  const issue = validateSection(section, tol)
  if (issue) throw new DegenerateSectionError(issue)
  const { a, b } = section
  const dE = b.e - a.e
  const dN = b.n - a.n
  const L = Math.hypot(dE, dN)
  return { a, b, L, uE: dE / L, uN: dN / L }
}

/** Chainage dan offset bertanda terhadap garis tak berhingga melalui A–B. */
export function projectWithBasis(p: ENZ, k: SectionBasis): Projected {
  const dE = p.e - k.a.e
  const dN = p.n - k.a.n
  return { s: dE * k.uE + dN * k.uN, o: k.uE * dN - k.uN * dE, z: p.z }
}

export function projectPoint(p: ENZ, section: Section): Projected {
  return projectWithBasis(p, sectionBasis(section))
}

export function reverseSection(section: Section): Section {
  return { a: { ...section.b }, b: { ...section.a } }
}

/** Apakah chainage berada di rentang 0 ≤ s ≤ L (dengan toleransi numerik). */
export function isOnAB(s: number, L: number, tol = NUM_TOL): boolean {
  return s >= -tol && s <= L + tol
}

function assertHalfWidth(w: number) {
  if (!(Number.isFinite(w) && w >= 0)) throw new RangeError('Setengah lebar koridor harus ≥ 0 m')
}

/** Titik lolos koridor bila |o| ≤ w. */
export function pointInCorridor(o: number, w: number, tol = NUM_TOL): boolean {
  assertHalfWidth(w)
  return Math.abs(o) <= w + tol
}

/** Bor lurus lolos bila [min(oc,ot), max(oc,ot)] beririsan dengan [−w, +w]. */
export function intervalInCorridor(oc: number, ot: number, w: number, tol = NUM_TOL): boolean {
  assertHalfWidth(w)
  const lo = Math.min(oc, ot)
  const hi = Math.max(oc, ot)
  return lo <= w + tol && hi >= -w - tol
}

/** Bentuk teks offset untuk label: magnitude + kiri/kanan/tepat pada bidang. */
export function offsetSide(o: number, tol = NUM_TOL): 'kiri' | 'kanan' | 'tepat' {
  if (Math.abs(o) <= tol) return 'tepat'
  return o > 0 ? 'kiri' : 'kanan'
}
