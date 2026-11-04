import type { Section } from '../domain/types'
import type { FileLike } from '../import/surface'
import type { FromWorker, ToWorker } from './protocol'

export type Transport = {
  postMessage(m: ToWorker): void
  onmessage: ((ev: { data: FromWorker }) => void) | null
  terminate?(): void
}

export type ClientEvents = {
  onImport?: (m: Extract<FromWorker, { type: 'progress' | 'choices' | 'surfaceReady' | 'error' }>) => void
  onSection?: (m: Extract<FromWorker, { type: 'sectionReady' }>) => void
  onSectionError?: (m: Extract<FromWorker, { type: 'error' }>) => void
}

/**
 * Sisi utama: memberi requestId, mengabaikan balasan terlambat berdasarkan
 * requestId/surfaceVersion, dan menggabungkan permintaan penampang selama
 * A/B digeser (paling banyak satu permintaan berjalan + satu menunggu).
 */
export class GeometryClient {
  private nextId = 1
  private importId = 0
  private surfaceVersion = 0
  private sectionInFlight: number | null = null
  private sectionQueued: Section | null = null
  private latestSectionId = 0
  private readonly t: Transport
  private readonly ev: ClientEvents

  constructor(t: Transport, ev: ClientEvents) {
    this.t = t
    this.ev = ev
    t.onmessage = (e) => this.receive(e.data)
  }

  get currentSurfaceVersion() {
    return this.surfaceVersion
  }

  loadSurface(files: FileLike[], confirmPair = false): number {
    const requestId = this.nextId++
    this.importId = requestId
    this.t.postMessage({ type: 'loadSurface', requestId, files, ...(confirmPair ? { confirmPair } : {}) })
    return requestId
  }

  selectSurface(candidateId: string, acceptPartial: boolean) {
    this.t.postMessage({ type: 'selectSurface', requestId: this.importId, candidateId, acceptPartial })
  }

  cancelImport() {
    if (this.importId) this.t.postMessage({ type: 'cancel', requestId: this.importId })
  }

  /** Permintaan terakhir selalu menghasilkan profil terbaru. */
  requestSection(section: Section) {
    if (this.surfaceVersion === 0) return
    if (this.sectionInFlight !== null) {
      this.sectionQueued = section
      return
    }
    this.send(section)
  }

  private send(section: Section) {
    const requestId = this.nextId++
    this.sectionInFlight = requestId
    this.latestSectionId = requestId
    this.t.postMessage({ type: 'computeSection', requestId, surfaceVersion: this.surfaceVersion, section })
  }

  private flushQueue(finishedId: number) {
    if (this.sectionInFlight === finishedId) this.sectionInFlight = null
    if (this.sectionInFlight === null && this.sectionQueued) {
      const s = this.sectionQueued
      this.sectionQueued = null
      this.send(s)
    }
  }

  private receive(m: FromWorker) {
    switch (m.type) {
      case 'progress':
      case 'choices':
        if (m.requestId === this.importId) this.ev.onImport?.(m)
        return
      case 'surfaceReady':
        if (m.requestId !== this.importId) return
        this.surfaceVersion = m.surfaceVersion
        // Hasil penampang untuk surface lama tidak lagi relevan.
        this.sectionInFlight = null
        this.ev.onImport?.(m)
        if (this.sectionQueued) this.flushQueue(-1)
        return
      case 'sectionReady': {
        const fresh = m.requestId === this.latestSectionId && m.surfaceVersion === this.surfaceVersion
        // Kirim permintaan yang menunggu lebih dulu; bila ada, hasil ini sudah usang.
        this.flushQueue(m.requestId)
        if (fresh && m.requestId === this.latestSectionId) this.ev.onSection?.(m)
        return
      }
      case 'error':
        if (m.requestId === this.importId) {
          this.ev.onImport?.(m)
          return
        }
        if (m.requestId === this.sectionInFlight || m.requestId === this.latestSectionId) {
          this.flushQueue(m.requestId)
          if (m.requestId === this.latestSectionId) this.ev.onSectionError?.(m)
        }
        return
    }
  }
}
