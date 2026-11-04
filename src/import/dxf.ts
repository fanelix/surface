/**
 * Pembaca DXF ASCII eksplisit untuk surface triangulasi (3DFACE dan POLYFACE).
 *
 * Keputusan M2: library umum (mis. dxf-parser) mempertahankan indeks muka POLYFACE
 * tetapi mencampur record muka ke daftar vertex dengan koordinat (0,0,0) dan tidak
 * memberi nomor baris. Pembaca ini membaca pasangan kode-grup secara langsung agar
 * konektivitas, tanda indeks, layer, handle, dan nomor baris terjaga.
 */
import type { Bounds3, ENZ, IssueLocation, Mesh, UnitStatus, ValidationIssue } from '../domain/types'
import { IssueCollector, MeshBuilder, coordinateSanityIssues } from './mesh-builder'

export type DxfCandidate = {
  layer: string
  mesh: Mesh
  bounds: Bounds3
  faceIds: string[]
  sourceCounts: { '3DFACE': number; POLYFACE: number }
  rejectedFaces: number
  verticalFaces: number
}

export type DxfParseOk = {
  ok: true
  fileName: string
  version: string | null
  units: UnitStatus
  candidates: DxfCandidate[]
  issues: ValidationIssue[]
  issueCounts: Record<string, number>
  stats: { pairs: number; entities: number; contourEntities: number }
}
export type DxfParseFail = { ok: false; fileName: string; issues: ValidationIssue[] }
export type DxfParseResult = DxfParseOk | DxfParseFail

export class ImportCancelledError extends Error {
  constructor() {
    super('Impor dibatalkan')
    this.name = 'ImportCancelledError'
  }
}

class FatalDxf extends Error {
  readonly issue: ValidationIssue
  constructor(issue: ValidationIssue) {
    super(issue.message)
    this.issue = issue
  }
}

/** Pemindai pasangan kode-grup tanpa memecah seluruh teks menjadi array baris. */
class PairScanner {
  pos = 0
  line = 0
  code = 0
  value = ''
  /** Nomor baris (1-basis) tempat kode grup saat ini. */
  codeLine = 0
  constructor(private readonly text: string, private readonly file: string) {}

  private readLine(): string | null {
    if (this.pos >= this.text.length) return null
    let end = this.text.indexOf('\n', this.pos)
    if (end < 0) end = this.text.length
    let s = this.text.slice(this.pos, end)
    if (s.endsWith('\r')) s = s.slice(0, -1)
    this.pos = end + 1
    this.line++
    return s
  }

  next(): boolean {
    const c = this.readLine()
    if (c === null) return false
    const trimmed = c.trim()
    if (trimmed === '' && this.pos >= this.text.length) return false
    this.codeLine = this.line
    if (!/^-?\d+$/.test(trimmed)) {
      throw new FatalDxf({
        code: this.line === 1 ? 'DXF_NOT_DXF' : 'DXF_STRUCTURE',
        severity: 'error',
        message:
          this.line === 1
            ? `Isi "${this.file}" bukan DXF ASCII. Periksa apakah berkas salah label (mis. CSV, STR, atau DTM).`
            : `Struktur DXF rusak: baris ${this.line} seharusnya kode grup angka, ditemukan "${trimmed.slice(0, 30)}".`,
        location: { file: this.file, line: this.line },
      })
    }
    this.code = Number(trimmed)
    const v = this.readLine()
    if (v === null) {
      throw new FatalDxf({
        code: 'DXF_STRUCTURE',
        severity: 'error',
        message: `Struktur DXF terpotong: kode grup pada baris ${this.codeLine} tidak memiliki nilai.`,
        location: { file: this.file, line: this.codeLine },
      })
    }
    this.value = v
    return true
  }

  get fraction() {
    return this.text.length === 0 ? 1 : Math.min(1, this.pos / this.text.length)
  }
}

type RawEntity = { type: string; line: number; g: Map<number, string> }

type Polyface = {
  layer: string
  handle: string
  line: number
  vertices: { p: ENZ; line: number }[]
  faces: { idx: number[]; line: number; handle: string }[]
}

const UNIT_NAMES: Record<number, string> = {
  1: 'inci', 2: 'kaki', 3: 'mil', 4: 'milimeter', 5: 'sentimeter', 6: 'meter', 7: 'kilometer',
  8: 'mikroinci', 9: 'mil (1/1000 inci)', 10: 'yard', 11: 'angstrom', 12: 'nanometer', 13: 'mikron',
  14: 'desimeter', 15: 'dekameter', 16: 'hektometer', 17: 'gigameter', 18: 'satuan astronomi',
  19: 'tahun cahaya', 20: 'parsec', 21: 'kaki survei AS',
}

function num(v: string | undefined): number {
  if (v === undefined) return NaN
  const t = v.trim()
  if (t === '') return NaN
  return Number(t)
}

const CONTOUR_TYPES = new Set(['LINE', 'LWPOLYLINE', 'SPLINE', 'ARC', 'CIRCLE', 'ELLIPSE'])

type Options = { batchPairs?: number }

/** Generator inti; yield fraksi progres tiap `batchPairs` pasangan. */
function* parseSteps(text: string, fileName: string, out: { result?: DxfParseResult }, opts: Options = {}): Generator<number> {
  const batch = opts.batchPairs ?? 100_000
  const issues = new IssueCollector()
  const builders = new Map<string, MeshBuilder>()
  const sourceCounts = new Map<string, { '3DFACE': number; POLYFACE: number }>()
  const layerFaceSeen = new Set<string>()
  let version: string | null = null
  let insUnits: number | null = null
  let entities = 0
  let contourEntities = 0
  let blockFaces = 0
  let sawEntities = false
  let sawEof = false
  let pairs = 0

  const loc = (layer: string, line: number, faceId?: string): IssueLocation => ({ file: fileName, layer, line, ...(faceId ? { faceId } : {}) })
  const builder = (layer: string) => {
    let b = builders.get(layer)
    if (!b) {
      b = new MeshBuilder(issues)
      builders.set(layer, b)
      sourceCounts.set(layer, { '3DFACE': 0, POLYFACE: 0 })
    }
    return b
  }

  let poly: Polyface | null = null
  let skippingPolyline = false
  let faceCounter = 0

  const finishPolyface = (pf: Polyface) => {
    const b = builder(pf.layer)
    sourceCounts.get(pf.layer)!.POLYFACE++
    layerFaceSeen.add(pf.layer)
    const nV = pf.vertices.length
    for (const f of pf.faces) {
      const id = f.handle || `PF${pf.handle}#${++faceCounter}`
      const L = loc(pf.layer, f.line, id)
      const idx = f.idx.map((i) => Math.abs(i)).filter((i) => i !== 0)
      if (idx.some((i) => !Number.isInteger(i) || i > nV)) {
        b.reject('FACE_INDEX_OUT_OF_RANGE', `Muka ${id} merujuk vertex di luar rentang 1–${nV}; muka dikeluarkan.`, L)
        continue
      }
      const distinct = [...new Set(idx)]
      if (distinct.length >= 4) {
        b.reject('FACE_QUAD_UNSUPPORTED', `Muka ${id} memiliki empat vertex berbeda; versi ini hanya menerima muka segitiga.`, L)
        continue
      }
      if (distinct.length < 3) {
        b.reject('FACE_DEGENERATE', `Muka ${id} memiliki kurang dari tiga vertex berbeda; muka dikeluarkan.`, L)
        continue
      }
      const [p, q, r] = distinct.map((i) => pf.vertices[i - 1]!.p) as [ENZ, ENZ, ENZ]
      b.addTriangle(p, q, r, id, L)
    }
  }

  const handleEntity = (e: RawEntity) => {
    const layer = (e.g.get(8) ?? '0').trim()
    const handle = (e.g.get(5) ?? '').trim()
    if (poly || skippingPolyline) {
      if (e.type === 'VERTEX') {
        if (!poly) return
        const flags = num(e.g.get(70)) || 0
        const isFace = (flags & 128) !== 0 && (flags & 64) === 0
        if (isFace || (!(flags & 64) && e.g.has(71))) {
          poly.faces.push({ idx: [71, 72, 73, 74].map((c) => num(e.g.get(c)) || 0), line: e.line, handle })
        } else {
          poly.vertices.push({ p: { e: num(e.g.get(10)), n: num(e.g.get(20)), z: num(e.g.get(30)) }, line: e.line })
        }
        return
      }
      if (e.type === 'SEQEND') {
        if (poly) finishPolyface(poly)
        poly = null
        skippingPolyline = false
        return
      }
      throw new FatalDxf({
        code: 'DXF_STRUCTURE',
        severity: 'error',
        message: `Struktur DXF rusak: POLYLINE tidak ditutup SEQEND sebelum entitas ${e.type} (baris ${e.line}).`,
        location: { file: fileName, line: e.line },
      })
    }
    entities++
    switch (e.type) {
      case '3DFACE': {
        const b = builder(layer)
        sourceCounts.get(layer)!['3DFACE']++
        layerFaceSeen.add(layer)
        const id = handle || `F${++faceCounter}`
        const L = loc(layer, e.line, id)
        const c = [0, 1, 2, 3].map((k) => ({ e: num(e.g.get(10 + k)), n: num(e.g.get(20 + k)), z: num(e.g.get(30 + k)) }))
        if (!e.g.has(13) && !e.g.has(23) && !e.g.has(33)) c[3] = c[2]!
        if (!c.every((p) => Number.isFinite(p.e) && Number.isFinite(p.n) && Number.isFinite(p.z))) {
          b.reject('FACE_NONFINITE', `3DFACE ${id} memiliki koordinat kosong atau bukan angka; muka dikeluarkan.`, L)
          return
        }
        const same = (p: ENZ, q: ENZ) => p.e === q.e && p.n === q.n && p.z === q.z
        // Ambil sudut berbeda dalam urutan aslinya (ekspor standar: sudut 4 = sudut 3).
        const pts: ENZ[] = []
        for (const p of c) if (!pts.some((q) => same(p, q))) pts.push(p)
        if (pts.length >= 4) {
          b.reject('FACE_QUAD_UNSUPPORTED', `3DFACE ${id} memiliki empat vertex berbeda; versi ini hanya menerima muka segitiga.`, L)
          return
        }
        if (pts.length < 3) {
          b.reject('FACE_DEGENERATE', `3DFACE ${id} memiliki kurang dari tiga vertex berbeda; muka dikeluarkan.`, L)
          return
        }
        b.addTriangle(pts[0]!, pts[1]!, pts[2]!, id, L)
        return
      }
      case 'POLYLINE': {
        const flags = num(e.g.get(70)) || 0
        if (flags & 64) {
          poly = { layer, handle, line: e.line, vertices: [], faces: [] }
        } else {
          skippingPolyline = true
          if (flags & 16) {
            issues.add({
              code: 'POLYGON_MESH_UNSUPPORTED',
              severity: 'warning',
              message: `POLYLINE mesh M×N pada baris ${e.line} belum didukung; ekspor sebagai 3DFACE atau POLYFACE segitiga.`,
              location: loc(layer, e.line, handle || undefined),
            })
          } else {
            contourEntities++
          }
        }
        return
      }
      case 'VERTEX':
      case 'SEQEND':
        throw new FatalDxf({
          code: 'DXF_STRUCTURE',
          severity: 'error',
          message: `Struktur DXF rusak: ${e.type} pada baris ${e.line} tidak didahului POLYLINE.`,
          location: { file: fileName, line: e.line },
        })
      default:
        if (CONTOUR_TYPES.has(e.type)) contourEntities++
    }
  }

  const s = new PairScanner(text, fileName)
  try {
    let section: string | null = null
    let headerVar: string | null = null
    let cur: RawEntity | null = null
    let expectSectionName = false
    while (s.next()) {
      pairs++
      if (pairs % batch === 0) yield s.fraction
      const { code, value } = s
      if (expectSectionName) {
        expectSectionName = false
        if (code === 2) {
          section = value.trim()
          if (section === 'ENTITIES') sawEntities = true
          continue
        }
      }
      if (code === 0) {
        const v = value.trim()
        if (section === 'ENTITIES' && cur) {
          handleEntity(cur)
          cur = null
        }
        if (v === 'SECTION') {
          expectSectionName = true
          continue
        }
        if (v === 'ENDSEC') {
          section = null
          continue
        }
        if (v === 'EOF') {
          sawEof = true
          break
        }
        if (section === 'ENTITIES') cur = { type: v, line: s.codeLine, g: new Map() }
        else if (section === 'BLOCKS' && (v === '3DFACE' || v === 'POLYLINE')) blockFaces++
        continue
      }
      if (section === 'HEADER') {
        if (code === 9) headerVar = value.trim()
        else if (headerVar === '$ACADVER' && code === 1) version = value.trim()
        else if (headerVar === '$INSUNITS' && code === 70) insUnits = num(value)
        continue
      }
      if (cur && !cur.g.has(code)) cur.g.set(code, value)
    }
    if (cur) handleEntity(cur)
    if (poly || skippingPolyline) {
      throw new FatalDxf({
        code: 'DXF_STRUCTURE',
        severity: 'error',
        message: 'Struktur DXF rusak: POLYLINE terakhir tidak ditutup SEQEND.',
        location: { file: fileName },
      })
    }
  } catch (err) {
    if (err instanceof FatalDxf) {
      out.result = { ok: false, fileName, issues: [err.issue] }
      return
    }
    throw err
  }
  yield 1

  if (!sawEof) {
    issues.add({ code: 'DXF_NO_EOF', severity: 'warning', message: 'Penanda EOF tidak ditemukan; berkas mungkin terpotong.', location: { file: fileName } })
  }
  if (blockFaces > 0) {
    issues.add({
      code: 'DXF_FACES_IN_BLOCKS',
      severity: 'warning',
      message: `${blockFaces} entitas muka berada di dalam BLOCK dan tidak dibaca. Ledakkan (explode) blok sebelum ekspor.`,
      location: { file: fileName },
    })
  }

  let units: UnitStatus
  if (insUnits === null || insUnits === 0 || !Number.isFinite(insUnits)) {
    units = { kind: 'unitless', source: insUnits === null ? '$INSUNITS tidak ada' : '$INSUNITS = 0 (tanpa unit)' }
  } else if (insUnits === 6) {
    units = { kind: 'meters', source: '$INSUNITS = 6' }
  } else {
    const label = UNIT_NAMES[insUnits] ?? `kode ${insUnits}`
    units = { kind: 'other', source: `$INSUNITS = ${insUnits}`, label }
    issues.add({
      code: 'UNITS_NOT_METERS',
      severity: 'warning',
      message: `Unit gambar DXF adalah ${label}, bukan meter. Aplikasi menghitung dalam meter; konversi data sebelum dipakai.`,
      location: { file: fileName },
    })
  }

  const candidates: DxfCandidate[] = []
  for (const [layer, b] of builders) {
    if (b.triangleCount === 0) {
      if (layerFaceSeen.has(layer)) {
        issues.add({
          code: 'DXF_LAYER_EMPTY',
          severity: 'warning',
          message: `Layer "${layer}" tidak memiliki muka segitiga yang valid.`,
          location: { file: fileName, layer },
        })
      }
      continue
    }
    const built = b.build()
    for (const i of coordinateSanityIssues(built.bounds, fileName)) issues.add({ ...i, location: { file: fileName, layer } })
    candidates.push({
      layer,
      mesh: built.mesh,
      bounds: built.bounds,
      faceIds: built.faceIds,
      sourceCounts: sourceCounts.get(layer)!,
      rejectedFaces: built.rejectedFaces,
      verticalFaces: built.verticalFaces,
    })
  }
  candidates.sort((a, b) => b.mesh.triangles.length - a.mesh.triangles.length || a.layer.localeCompare(b.layer))

  if (candidates.length === 0) {
    let issue: ValidationIssue
    if (layerFaceSeen.size > 0) {
      issue = { code: 'DXF_NO_VALID_FACES', severity: 'error', message: 'Semua muka pada berkas rusak atau tidak didukung; tidak ada segitiga yang dapat dipakai.', location: { file: fileName } }
    } else if (!sawEntities || entities === 0) {
      issue = { code: 'DXF_NO_ENTITIES', severity: 'error', message: 'Berkas DXF tidak memiliki entitas pada bagian ENTITIES.', location: { file: fileName } }
    } else if (contourEntities > 0) {
      issue = {
        code: 'DXF_CONTOURS_ONLY',
        severity: 'error',
        message: `Berkas hanya berisi garis/kontur (${contourEntities} entitas), tanpa muka segitiga. Aplikasi tidak membentuk TIN dari kontur; ekspor surface sebagai 3DFACE atau POLYFACE.`,
        location: { file: fileName },
      }
    } else {
      issue = { code: 'DXF_NO_FACES', severity: 'error', message: 'Tidak ditemukan 3DFACE atau POLYFACE segitiga pada berkas.', location: { file: fileName } }
    }
    out.result = { ok: false, fileName, issues: [issue, ...issues.list] }
    return
  }

  out.result = {
    ok: true,
    fileName,
    version,
    units,
    candidates,
    issues: issues.list,
    issueCounts: issues.counts,
    stats: { pairs, entities, contourEntities },
  }
}

function binaryFail(text: string, fileName: string): DxfParseFail | null {
  if (text.startsWith('AutoCAD Binary DXF')) {
    return {
      ok: false,
      fileName,
      issues: [{ code: 'DXF_BINARY', severity: 'error', message: 'DXF biner belum didukung. Simpan ulang sebagai DXF ASCII.', location: { file: fileName } }],
    }
  }
  return null
}

export function parseDxf(text: string, fileName: string): DxfParseResult {
  const bin = binaryFail(text, fileName)
  if (bin) return bin
  const out: { result?: DxfParseResult } = {}
  const it = parseSteps(text, fileName, out)
  while (!it.next().done) {
    /* jalankan sampai selesai */
  }
  return out.result!
}

export type AsyncOptions = Options & { signal?: AbortSignal; onProgress?: (fraction: number) => void; yieldFn?: () => Promise<void> }

const defaultYield = () => new Promise<void>((r) => setTimeout(r, 0))

/** Diproses per batch dan memberi giliran event loop agar pembatalan dapat diterima. */
export async function parseDxfAsync(text: string, fileName: string, opts: AsyncOptions = {}): Promise<DxfParseResult> {
  const bin = binaryFail(text, fileName)
  if (bin) return bin
  const out: { result?: DxfParseResult } = {}
  const it = parseSteps(text, fileName, out, opts)
  const y = opts.yieldFn ?? defaultYield
  for (;;) {
    if (opts.signal?.aborted) throw new ImportCancelledError()
    const step = it.next()
    if (step.done) break
    opts.onProgress?.(step.value)
    await y()
  }
  return out.result!
}
