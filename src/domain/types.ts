// Kontrak data inti (IMPLEMENTATION_PLAN.md bagian 3).
// Semua koordinat dunia memakai meter dan angka 64-bit (number / Float64Array).

export type XY = { e: number; n: number }
export type ENZ = XY & { z: number }
export type NamedPoint = ENZ & { id: string; name: string }
export type Borehole = {
  id: string
  name: string
  collar: ENZ
  /** Panjang sepanjang lubang (measured depth), meter, > 0. */
  md: number
  /** Azimuth searah jarum jam dari utara grid, derajat [0,360). */
  azDeg: number
  /** Dip dari horizontal, negatif ke bawah, −90 = vertikal ke bawah. */
  dipDeg: number
}
export type Section = { a: XY; b: XY }
/** s = chainage dari A sepanjang A→B; o = offset bertanda (kiri positif); z = elevasi asli. */
export type Projected = { s: number; o: number; z: number }
/** xyz = triple E,N,Z; triangles = indeks 0-basis ke triple. */
export type Mesh = { xyz: Float64Array; triangles: Uint32Array }
export type ProfileVertex = { s: number; z: number }
export type Profile = {
  /** Bagian profil kontinu. Bagian dengan satu vertex = sentuhan tunggal (marker). */
  parts: ProfileVertex[][]
  /** Rentang chainage [s0,s1] tempat dua segitiga atau lebih memberi Z berbeda. */
  ambiguous: [number, number][]
  /** Ekstensi: indeks segitiga yang terlibat di tiap rentang ambigu (selaras dengan `ambiguous`). */
  ambiguousFaces?: number[][]
}

export type PlaneHit =
  | { kind: 'none' }
  | {
      kind: 'in-plane'
      /** Ekstensi: rentang chainage lintasan pada bidang dan hubungannya dengan A–B. */
      sRange: [number, number]
      abCoverage: 'inside' | 'partial' | 'outside'
    }
  | { kind: 'touch' | 'cross'; md: number; s: number; z: number; onAB: boolean }

export type Severity = 'error' | 'warning' | 'info'

export type IssueLocation = {
  file?: string
  layer?: string
  /** Nomor baris 1-basis pada berkas sumber. */
  line?: number
  /** Handle DXF atau nomor urut muka. */
  faceId?: string
  column?: string
}

export type ValidationIssue = {
  code: string
  severity: Severity
  /** Pesan berbahasa Indonesia untuk pengguna. */
  message: string
  location?: IssueLocation
}

export type Bounds3 = { min: ENZ; max: ENZ }

export type UnitStatus =
  | { kind: 'meters'; source: string }
  | { kind: 'unitless'; source: string }
  | { kind: 'other'; source: string; label: string }
