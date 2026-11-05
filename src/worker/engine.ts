import type { Mesh } from '../domain/types'
import { originFromBounds } from '../domain/coordinates'
import { ImportCancelledError } from '../import/dxf'
import type { DxfParseOk } from '../import/dxf'
import { openSurfaceFiles } from '../import/open-surface'
import { buildMeshIndex } from '../geometry/mesh-index'
import type { MeshIndex } from '../geometry/mesh-index'
import { sliceSurface } from '../geometry/profile'
import type { SliceStats } from '../geometry/profile'
import { DegenerateSectionError } from '../geometry/section'
import type { CandidateInfo, FromWorker, RenderBuffers, SurfaceSummary, ToWorker } from './protocol'

type Active = { version: number; mesh: Mesh; index: MeshIndex; summary: SurfaceSummary }
type Pending = { requestId: number; parsed: DxfParseOk; format: 'dxf' | 'surpac'; bytes: number; startedAt: number }

/**
 * Pemilik mesh Float64 dan indeks spasial. Logika murni tanpa ketergantungan Worker
 * agar dapat diuji di Node; geometry.worker.ts hanya meneruskan pesan.
 */
export class GeometryEngine {
  private active: Active | null = null
  private pending: Pending | null = null
  private version = 0
  private readonly aborts = new Map<number, AbortController>()
  private readonly post: (m: FromWorker, transfer?: Transferable[]) => void
  private readonly now: () => number
  private readonly yieldFn: (() => Promise<void>) | undefined

  constructor(post: (m: FromWorker, transfer?: Transferable[]) => void, opts: { now?: () => number; yieldFn?: () => Promise<void> } = {}) {
    this.post = post
    this.now = opts.now ?? (() => performance.now())
    this.yieldFn = opts.yieldFn
  }

  get activeVersion() {
    return this.active?.version ?? 0
  }

  async handle(msg: ToWorker): Promise<void> {
    switch (msg.type) {
      case 'loadSurface':
        return this.load(msg.requestId, msg)
      case 'selectSurface':
        return this.select(msg.requestId, msg.candidateId, msg.acceptPartial)
      case 'computeSection':
        return this.compute(msg.requestId, msg.surfaceVersion, msg.section)
      case 'cancel': {
        this.aborts.get(msg.requestId)?.abort()
        if (this.pending?.requestId === msg.requestId) {
          this.pending = null
          this.post({ type: 'error', requestId: msg.requestId, cancelled: true, issues: [{ code: 'IMPORT_CANCELLED', severity: 'info', message: 'Impor dibatalkan. Surface aktif sebelumnya dipertahankan.' }] })
        }
        return
      }
    }
  }

  private async load(requestId: number, msg: Extract<ToWorker, { type: 'loadSurface' }>) {
    const ctl = new AbortController()
    this.aborts.set(requestId, ctl)
    this.pending = null
    const startedAt = this.now()
    try {
      const res = await openSurfaceFiles(msg.files, {
        signal: ctl.signal,
        ...(msg.confirmPair ? { confirmPair: true } : {}),
        ...(this.yieldFn ? { yieldFn: this.yieldFn } : {}),
        onProgress: (phase, fraction) => this.post({ type: 'progress', requestId, phase, fraction }),
      })
      if (ctl.signal.aborted) throw new ImportCancelledError()
      if (!res.ok) {
        this.post({ type: 'error', requestId, issues: res.issues, ...(res.needsPairConfirmation ? { needsPairConfirmation: res.needsPairConfirmation } : {}) })
        return
      }
      this.pending = { requestId, parsed: res.dxf, format: res.format, bytes: res.bytes, startedAt }
      const c = res.dxf.candidates
      const partial = c.some((x) => x.rejectedFaces > 0)
      if (c.length === 1 && !partial) {
        await this.select(requestId, c[0]!.layer, false)
        return
      }
      this.post({
        type: 'choices',
        requestId,
        fileName: res.dxf.fileName,
        candidates: c.map<CandidateInfo>((x) => ({
          id: x.layer,
          layer: x.layer,
          triangles: x.mesh.triangles.length / 3,
          vertices: x.mesh.xyz.length / 3,
          rejectedFaces: x.rejectedFaces,
          verticalFaces: x.verticalFaces,
          bounds: x.bounds,
        })),
        issues: res.dxf.issues,
        issueCounts: res.dxf.issueCounts,
        units: res.dxf.units,
        partial,
      })
    } catch (err) {
      if (err instanceof ImportCancelledError) {
        this.post({ type: 'error', requestId, cancelled: true, issues: [{ code: 'IMPORT_CANCELLED', severity: 'info', message: 'Impor dibatalkan. Surface aktif sebelumnya dipertahankan.' }] })
        return
      }
      this.post({ type: 'error', requestId, issues: [{ code: 'IMPORT_FAILED', severity: 'error', message: `Impor gagal: ${(err as Error).message}` }] })
    } finally {
      this.aborts.delete(requestId)
    }
  }

  private async select(requestId: number, candidateId: string, acceptPartial: boolean) {
    const p = this.pending
    if (!p || p.requestId !== requestId) {
      this.post({ type: 'error', requestId, issues: [{ code: 'NO_PENDING_IMPORT', severity: 'error', message: 'Tidak ada impor yang menunggu pilihan. Buka berkas lagi.' }] })
      return
    }
    const cand = p.parsed.candidates.find((c) => c.layer === candidateId)
    if (!cand) {
      this.post({ type: 'error', requestId, issues: [{ code: 'NO_SUCH_LAYER', severity: 'error', message: `Layer "${candidateId}" tidak ditemukan.` }] })
      return
    }
    if (cand.rejectedFaces > 0 && !acceptPartial) {
      this.post({ type: 'error', requestId, issues: [{ code: 'PARTIAL_NOT_ACCEPTED', severity: 'error', message: 'Sebagian muka rusak; konfirmasi untuk melanjutkan dengan muka valid saja.' }] })
      return
    }
    this.post({ type: 'progress', requestId, phase: 'indeks', fraction: 0 })
    const index = buildMeshIndex(cand.mesh)
    const layerIssues = p.parsed.issues.filter((i) => !i.location?.layer || i.location.layer === cand.layer)
    this.version++
    const summary: SurfaceSummary = {
      fileName: p.parsed.fileName,
      format: p.format,
      bytes: p.bytes,
      layer: cand.layer,
      triangleCount: cand.mesh.triangles.length / 3,
      vertexCount: cand.mesh.xyz.length / 3,
      bounds: cand.bounds,
      units: p.parsed.units,
      version: p.parsed.version,
      rejectedFaces: cand.rejectedFaces,
      verticalFaces: cand.verticalFaces,
      excludedFromProfile: index.excludedCount,
      issues: layerIssues,
      issueCounts: p.parsed.issueCounts,
      importMs: this.now() - p.startedAt,
    }
    this.active = { version: this.version, mesh: cand.mesh, index, summary }
    this.pending = null
    const render = makeRenderBuffers(cand.mesh, summary)
    this.post({ type: 'surfaceReady', requestId, surfaceVersion: this.version, summary, render }, [render.positions.buffer, render.indices.buffer])
  }

  private compute(requestId: number, surfaceVersion: number, section: Extract<ToWorker, { type: 'computeSection' }>['section']) {
    const a = this.active
    if (!a || a.version !== surfaceVersion) {
      this.post({ type: 'error', requestId, issues: [{ code: 'STALE_SURFACE', severity: 'info', message: 'Permintaan penampang untuk surface lama diabaikan.' }] })
      return
    }
    const t0 = this.now()
    try {
      const stats: SliceStats = { candidates: 0, intervals: 0, touches: 0, excludedFaces: 0 }
      const profile = sliceSurface(a.mesh, a.index, section, stats)
      this.post({ type: 'sectionReady', requestId, surfaceVersion, section, profile, elapsedMs: this.now() - t0, excludedFaces: stats.excludedFaces })
    } catch (err) {
      if (err instanceof DegenerateSectionError) {
        this.post({ type: 'error', requestId, issues: [err.issue] })
        return
      }
      throw err
    }
  }
}

export function makeRenderBuffers(mesh: Mesh, summary: { bounds: SurfaceSummary['bounds'] }): RenderBuffers {
  const origin = originFromBounds(summary.bounds)
  const n = mesh.xyz.length / 3
  const positions = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    positions[i * 3] = mesh.xyz[i * 3]! - origin.e0
    positions[i * 3 + 1] = mesh.xyz[i * 3 + 2]! - origin.z0
    positions[i * 3 + 2] = -(mesh.xyz[i * 3 + 1]! - origin.n0)
  }
  return { origin, positions, indices: mesh.triangles.slice() }
}
