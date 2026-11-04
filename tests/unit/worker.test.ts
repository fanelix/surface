import { describe, expect, it } from 'vitest'
import type { Section } from '../../src/domain/types'
import { GeometryEngine } from '../../src/worker/engine'
import { GeometryClient } from '../../src/worker/client'
import type { Transport } from '../../src/worker/client'
import type { FromWorker, ToWorker } from '../../src/worker/protocol'
import { fakeFile, loadExpected, readFixtureText } from './helpers'

const X = loadExpected()
const SEC: Section = { a: { e: X.a[0], n: X.a[1] }, b: { e: X.b[0], n: X.b[1] } }

function engineHarness() {
  const out: FromWorker[] = []
  const eng = new GeometryEngine((m) => out.push(m), { yieldFn: async () => {} })
  return { eng, out, last: <T extends FromWorker['type']>(t: T) => out.filter((m) => m.type === t).at(-1) as Extract<FromWorker, { type: T }> | undefined }
}

const fixtureFile = (name: string) => {
  const text = readFixtureText(name)
  return fakeFile(name, new TextEncoder().encode(text).byteLength, text)
}

describe('GeometryEngine', () => {
  it('memuat surface, menghitung penampang dengan surfaceVersion dan requestId', async () => {
    const { eng, last } = engineHarness()
    await eng.handle({ type: 'loadSurface', requestId: 1, files: [fixtureFile('bench_3dface.dxf')] })
    const ready = last('surfaceReady')!
    expect(ready.surfaceVersion).toBe(1)
    expect(ready.summary.triangleCount).toBe(10)
    expect(ready.summary.units.kind).toBe('unitless')
    // buffer render Float32 terpisah dengan origin lokal
    expect(ready.render.positions).toBeInstanceOf(Float32Array)
    expect(ready.render.origin.e0).toBe(700050)
    expect(Math.max(...ready.render.positions)).toBeLessThan(100)
    await eng.handle({ type: 'computeSection', requestId: 2, surfaceVersion: 1, section: SEC })
    const s = last('sectionReady')!
    expect(s.requestId).toBe(2)
    expect(s.profile.parts.length).toBe(1)
  })

  it('impor baru yang gagal tidak merusak surface aktif', async () => {
    const { eng, out, last } = engineHarness()
    await eng.handle({ type: 'loadSurface', requestId: 1, files: [fixtureFile('bench_3dface.dxf')] })
    await eng.handle({ type: 'loadSurface', requestId: 2, files: [fakeFile('rusak.dxf', 20, 'bukan dxf sama sekali')] })
    expect(last('error')!.requestId).toBe(2)
    expect(eng.activeVersion).toBe(1)
    await eng.handle({ type: 'computeSection', requestId: 3, surfaceVersion: 1, section: SEC })
    expect(out.at(-1)!.type).toBe('sectionReady')
  })

  it('impor terlalu besar ditolak tanpa membaca; surface aktif tetap', async () => {
    const { eng, last } = engineHarness()
    await eng.handle({ type: 'loadSurface', requestId: 1, files: [fixtureFile('gap_3dface.dxf')] })
    const big = fakeFile('besar.dxf', 25_000_001)
    await eng.handle({ type: 'loadSurface', requestId: 2, files: [big] })
    expect(big.reads).toBe(0)
    expect(last('error')!.issues[0]!.code).toBe('SURFACE_TOO_LARGE')
    expect(eng.activeVersion).toBe(1)
  })

  it('pembatalan impor saat diproses per batch mempertahankan surface aktif', async () => {
    const out: FromWorker[] = []
    let yields = 0
    const eng: GeometryEngine = new GeometryEngine((m) => out.push(m), {
      yieldFn: async () => {
        yields++
        if (yields === 1) await eng.handle({ type: 'cancel', requestId: 2 })
      },
    })
    await eng.handle({ type: 'loadSurface', requestId: 1, files: [fixtureFile('bench_3dface.dxf')] })
    yields = 0
    await eng.handle({ type: 'loadSurface', requestId: 2, files: [fixtureFile('bench_polyface.dxf')] })
    const err = out.filter((m) => m.type === 'error').at(-1) as Extract<FromWorker, { type: 'error' }>
    expect(err.cancelled).toBe(true)
    expect(eng.activeVersion).toBe(1)
  })

  it('permintaan untuk surfaceVersion lama dijawab STALE_SURFACE', async () => {
    const { eng, last } = engineHarness()
    await eng.handle({ type: 'loadSurface', requestId: 1, files: [fixtureFile('bench_3dface.dxf')] })
    await eng.handle({ type: 'loadSurface', requestId: 2, files: [fixtureFile('gap_3dface.dxf')] })
    await eng.handle({ type: 'computeSection', requestId: 3, surfaceVersion: 1, section: SEC })
    expect(last('error')!.issues[0]!.code).toBe('STALE_SURFACE')
  })

  it('beberapa layer → choices, lalu selectSurface', async () => {
    // Ubah dua muka terakhir ke layer DESAIN.
    let n = 0
    const multi = readFixtureText('bench_3dface.dxf').replace(/ {2}8\nTOPO/g, (m) => (++n > 8 ? '  8\nDESAIN' : m))
    const { eng, last } = engineHarness()
    await eng.handle({ type: 'loadSurface', requestId: 5, files: [fakeFile('multi.dxf', multi.length, multi)] })
    const ch = last('choices')!
    expect(ch.candidates.map((c) => c.layer)).toEqual(['TOPO', 'DESAIN'])
    await eng.handle({ type: 'selectSurface', requestId: 5, candidateId: 'DESAIN', acceptPartial: false })
    expect(last('surfaceReady')!.summary.triangleCount).toBe(2)
  })

  it('A=B dijawab error spesifik', async () => {
    const { eng, last } = engineHarness()
    await eng.handle({ type: 'loadSurface', requestId: 1, files: [fixtureFile('bench_3dface.dxf')] })
    await eng.handle({ type: 'computeSection', requestId: 2, surfaceVersion: 1, section: { a: SEC.a, b: SEC.a } })
    expect(last('error')!.issues[0]!.code).toBe('SECTION_ZERO_LENGTH')
  })
})

/** Transport manual: tes mengendalikan kapan dan dalam urutan apa balasan tiba. */
function manualTransport() {
  const sent: ToWorker[] = []
  const t: Transport = { postMessage: (m) => void sent.push(m), onmessage: null }
  const deliver = (m: FromWorker) => t.onmessage!({ data: m })
  return { t, sent, deliver }
}

const fakeReady = (requestId: number, surfaceVersion: number): FromWorker => ({
  type: 'surfaceReady',
  requestId,
  surfaceVersion,
  summary: {} as never,
  render: {} as never,
})
const fakeSection = (requestId: number, surfaceVersion: number, section: Section): FromWorker => ({
  type: 'sectionReady', requestId, surfaceVersion, section, profile: { parts: [], ambiguous: [] }, elapsedMs: 1, excludedFaces: 0,
})

describe('GeometryClient', () => {
  const s = (e: number): Section => ({ a: { e: 0, n: 0 }, b: { e, n: 0 } })

  it('menggabungkan event drag: satu berjalan, satu menunggu, gerakan terakhir menang', () => {
    const { t, sent, deliver } = manualTransport()
    const got: number[] = []
    const c = new GeometryClient(t, { onSection: (m) => got.push(m.section.b.e) })
    const imp = c.loadSurface([])
    deliver(fakeReady(imp, 1))
    c.requestSection(s(10))
    c.requestSection(s(20))
    c.requestSection(s(30))
    const computes = () => sent.filter((m) => m.type === 'computeSection') as Extract<ToWorker, { type: 'computeSection' }>[]
    expect(computes().length).toBe(1)
    deliver(fakeSection(computes()[0]!.requestId, 1, s(10)))
    // hasil s(10) sudah usang karena s(30) menunggu → tidak dipasang
    expect(got).toEqual([])
    expect(computes().length).toBe(2)
    expect(computes()[1]!.section.b.e).toBe(30)
    deliver(fakeSection(computes()[1]!.requestId, 1, s(30)))
    expect(got).toEqual([30])
  })

  it('balasan lama yang tiba belakangan diabaikan', () => {
    const { t, sent, deliver } = manualTransport()
    const got: number[] = []
    const c = new GeometryClient(t, { onSection: (m) => got.push(m.section.b.e) })
    deliver(fakeReady(c.loadSurface([]), 1))
    c.requestSection(s(10))
    const r1 = (sent.at(-1) as Extract<ToWorker, { type: 'computeSection' }>).requestId
    deliver(fakeSection(r1, 1, s(10)))
    c.requestSection(s(20))
    const r2 = (sent.at(-1) as Extract<ToWorker, { type: 'computeSection' }>).requestId
    deliver(fakeSection(r2, 1, s(20)))
    deliver(fakeSection(r1, 1, s(10))) // duplikat/terlambat
    expect(got).toEqual([10, 20])
  })

  it('hasil untuk surface lama diabaikan setelah surface baru aktif', () => {
    const { t, sent, deliver } = manualTransport()
    const got: number[] = []
    const c = new GeometryClient(t, { onSection: (m) => got.push(m.surfaceVersion) })
    deliver(fakeReady(c.loadSurface([]), 1))
    c.requestSection(s(10))
    const r1 = (sent.at(-1) as Extract<ToWorker, { type: 'computeSection' }>).requestId
    deliver(fakeReady(c.loadSurface([]), 2))
    deliver(fakeSection(r1, 1, s(10)))
    expect(got).toEqual([])
    c.requestSection(s(10))
    const r2 = (sent.at(-1) as Extract<ToWorker, { type: 'computeSection' }>).requestId
    deliver(fakeSection(r2, 2, s(10)))
    expect(got).toEqual([2])
  })

  it('impor baru yang gagal tidak mengubah surfaceVersion aktif', () => {
    const { t, deliver } = manualTransport()
    const imports: string[] = []
    const c = new GeometryClient(t, { onImport: (m) => imports.push(m.type) })
    deliver(fakeReady(c.loadSurface([]), 1))
    const r = c.loadSurface([])
    deliver({ type: 'error', requestId: r, issues: [{ code: 'DXF_NOT_DXF', severity: 'error', message: 'x' }] })
    expect(c.currentSurfaceVersion).toBe(1)
    expect(imports).toEqual(['surfaceReady', 'error'])
  })

  it('balasan impor lama (requestId usang) diabaikan', () => {
    const { t, deliver } = manualTransport()
    const c = new GeometryClient(t, {})
    const r1 = c.loadSurface([])
    const r2 = c.loadSurface([])
    deliver(fakeReady(r1, 1))
    expect(c.currentSurfaceVersion).toBe(0)
    deliver(fakeReady(r2, 2))
    expect(c.currentSurfaceVersion).toBe(2)
  })

  it('integrasi dengan engine nyata melalui transport sinkron', async () => {
    const eng = new GeometryEngine((m) => queue.push(m), { yieldFn: async () => {} })
    const queue: FromWorker[] = []
    const pending: Promise<void>[] = []
    const t: Transport = { postMessage: (m) => void pending.push(eng.handle(m)), onmessage: null }
    const got: number[] = []
    const c = new GeometryClient(t, { onSection: (m) => got.push(m.profile.parts.length) })
    c.loadSurface([fixtureFile('gap_3dface.dxf')])
    const pump = async () => {
      while (pending.length) await pending.shift()
      while (queue.length) t.onmessage!({ data: queue.shift()! })
    }
    await pump()
    c.requestSection(SEC)
    await pump()
    await pump()
    expect(got).toEqual([2])
  })
})
