import type { Bounds3, Profile, Section, UnitStatus, ValidationIssue } from '../domain/types'
import type { RenderOrigin } from '../domain/coordinates'
import type { FileLike } from '../import/surface'

export type CandidateInfo = {
  id: string
  layer: string
  triangles: number
  vertices: number
  rejectedFaces: number
  verticalFaces: number
  bounds: Bounds3
}

export type SurfaceSummary = {
  fileName: string
  format: 'dxf' | 'surpac'
  bytes: number
  layer: string
  triangleCount: number
  vertexCount: number
  bounds: Bounds3
  units: UnitStatus
  version: string | null
  rejectedFaces: number
  verticalFaces: number
  /** Segitiga yang dikeluarkan dari profil 2.5D. */
  excludedFromProfile: number
  issues: ValidationIssue[]
  issueCounts: Record<string, number>
  importMs: number
}

export type RenderBuffers = {
  origin: RenderOrigin
  /** Float32 (E−E0, Z−Z0, −(N−N0)) per vertex. Buffer terpisah dari mesh Float64 utama. */
  positions: Float32Array
  indices: Uint32Array
}

export type ToWorker =
  | { type: 'loadSurface'; requestId: number; files: FileLike[]; confirmPair?: boolean }
  | { type: 'selectSurface'; requestId: number; candidateId: string; acceptPartial: boolean }
  | { type: 'computeSection'; requestId: number; surfaceVersion: number; section: Section }
  | { type: 'cancel'; requestId: number }

export type FromWorker =
  | { type: 'progress'; requestId: number; phase: 'baca' | 'urai' | 'indeks'; fraction: number }
  | {
      type: 'choices'
      requestId: number
      fileName: string
      candidates: CandidateInfo[]
      issues: ValidationIssue[]
      issueCounts: Record<string, number>
      units: UnitStatus
      /** true bila sebagian muka ditolak sehingga pengguna harus memilih melanjutkan. */
      partial: boolean
    }
  | { type: 'surfaceReady'; requestId: number; surfaceVersion: number; summary: SurfaceSummary; render: RenderBuffers }
  | { type: 'sectionReady'; requestId: number; surfaceVersion: number; section: Section; profile: Profile; elapsedMs: number; excludedFaces: number }
  | { type: 'error'; requestId: number; issues: ValidationIssue[]; cancelled?: boolean; needsPairConfirmation?: { dtm: string; str: string } }
