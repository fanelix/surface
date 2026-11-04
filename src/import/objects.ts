/**
 * Input titik dan lubang bor: CSV dan formulir memakai fungsi validasi yang sama.
 */
import type { Borehole, NamedPoint, ValidationIssue } from '../domain/types'

export type ObjectKind = 'point' | 'borehole'
export type DipConvention = 'negative-down' | 'positive-down'

export type PointField = 'name' | 'easting' | 'northing' | 'elevation'
export type BoreholeField = PointField | 'depth' | 'azimuth' | 'dip'
export type Field = BoreholeField

export const FIELDS: Record<ObjectKind, Field[]> = {
  point: ['name', 'easting', 'northing', 'elevation'],
  borehole: ['name', 'easting', 'northing', 'elevation', 'depth', 'azimuth', 'dip'],
}

export const FIELD_LABEL: Record<Field, string> = {
  name: 'Nama',
  easting: 'Easting',
  northing: 'Northing',
  elevation: 'Elevation',
  depth: 'Kedalaman (MD)',
  azimuth: 'Azimuth',
  dip: 'Dip',
}

/** Alias header (dinormalisasi: huruf kecil, tanpa spasi/tanda baca/isi kurung). */
const ALIASES: Record<Field, string[]> = {
  name: ['name', 'nama', 'namatitik', 'namatitikbor', 'namabor', 'id', 'pointid', 'point', 'titik', 'holeid', 'hole', 'bhid', 'bor', 'kode'],
  easting: ['easting', 'east', 'e', 'x', 'timur'],
  northing: ['northing', 'north', 'n', 'y', 'utara'],
  elevation: ['elevation', 'elevasi', 'elev', 'z', 'rl', 'elevasicollar', 'collarz', 'zcollar', 'collarelevation', 'collarrl'],
  depth: ['depth', 'md', 'kedalaman', 'kedalamanmd', 'measureddepth', 'length', 'panjang', 'totaldepth', 'maxdepth'],
  azimuth: ['azimuth', 'azimut', 'az', 'bearing', 'arah'],
  dip: ['dip', 'kemiringan'],
}

export function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]/g, '')
}

/** Kunci duplikat: trim + normalisasi Unicode + huruf kecil. */
export function nameKey(name: string): string {
  return name.trim().normalize('NFC').toLocaleLowerCase('id-ID')
}

export function objectId(kind: ObjectKind, name: string): string {
  return `${kind}:${nameKey(name)}`
}

// ---------- CSV ----------

export type CsvRow = { line: number; cells: string[] }
export type CsvTable = { delimiter: ',' | ';'; header: CsvRow | null; rows: CsvRow[]; bom: boolean }

/** Pemisah kolom: titik koma bila lebih banyak dari koma di baris header (di luar kutip). */
export function detectDelimiter(firstLine: string): ',' | ';' {
  let inQ = false, comma = 0, semi = 0
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ
    else if (!inQ && ch === ',') comma++
    else if (!inQ && ch === ';') semi++
  }
  return semi > 0 && semi >= comma ? ';' : ','
}

/** RFC 4180 sederhana: kutip ganda, "" sebagai escape, baris baru di dalam kutip. */
export function parseCsv(text: string): CsvTable {
  const bom = text.startsWith('\uFEFF')
  const src = bom ? text.slice(1) : text
  const firstLine = src.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = detectDelimiter(firstLine)
  const rows: CsvRow[] = []
  let line = 1
  let rowLine = 1
  let cells: string[] = []
  let cell = ''
  let inQ = false
  let quoted = false
  const pushCell = () => {
    cells.push(quoted ? cell : cell.trim())
    cell = ''
    quoted = false
  }
  const pushRow = () => {
    pushCell()
    if (!(cells.length === 1 && cells[0] === '')) rows.push({ line: rowLine, cells })
    cells = []
  }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else inQ = false
      } else {
        if (ch === '\n') line++
        cell += ch
      }
      continue
    }
    if (ch === '"' && cell.trim() === '') {
      inQ = true
      quoted = true
      cell = ''
    } else if (ch === delimiter) pushCell()
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      pushRow()
      line++
      rowLine = line
    } else cell += ch
  }
  if (cell !== '' || cells.length > 0) pushRow()
  const [header, ...rest] = rows
  return { delimiter, header: header ?? null, rows: rest, bom }
}

// ---------- angka ----------

const NUM_RE = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/
const COMMA_DEC_RE = /^[+-]?\d+,\d+$/

export type NumberFormat = { decimalComma: boolean }

/** Mengembalikan angka finite, atau alasan penolakan. */
export function parseNumber(raw: string, fmt: NumberFormat): { ok: true; value: number } | { ok: false; reason: 'kosong' | 'bukan angka' | 'ambigu' } {
  const t = raw.trim()
  if (t === '') return { ok: false, reason: 'kosong' }
  if (NUM_RE.test(t)) {
    const v = Number(t)
    return Number.isFinite(v) ? { ok: true, value: v } : { ok: false, reason: 'bukan angka' }
  }
  if (COMMA_DEC_RE.test(t)) {
    if (!fmt.decimalComma) return { ok: false, reason: 'ambigu' }
    return { ok: true, value: Number(t.replace(',', '.')) }
  }
  return { ok: false, reason: 'bukan angka' }
}

// ---------- validasi bersama ----------

export type RawObject = Partial<Record<Field, string | number>>

export type ValidationResult<T> = { ok: true; value: T; reasons: [] } | { ok: false; reasons: string[] }

function num(raw: RawObject, f: Field, fmt: NumberFormat, reasons: string[]): number {
  const v = raw[f]
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) {
      reasons.push(`${FIELD_LABEL[f]} bukan angka finite`)
      return NaN
    }
    return v
  }
  const r = parseNumber(v ?? '', fmt)
  if (!r.ok) {
    reasons.push(
      r.reason === 'kosong'
        ? `${FIELD_LABEL[f]} kosong`
        : r.reason === 'ambigu'
          ? `${FIELD_LABEL[f]} "${String(v)}" ambigu (koma desimal hanya diterima bila pemisah kolom titik koma)`
          : `${FIELD_LABEL[f]} "${String(v)}" bukan angka`,
    )
    return NaN
  }
  return r.value
}

function nameOf(raw: RawObject, reasons: string[]): string {
  const n = String(raw.name ?? '').trim()
  if (n === '') reasons.push('Nama kosong')
  return n
}

export function validatePoint(raw: RawObject, fmt: NumberFormat): ValidationResult<NamedPoint> {
  const reasons: string[] = []
  const name = nameOf(raw, reasons)
  const e = num(raw, 'easting', fmt, reasons)
  const n = num(raw, 'northing', fmt, reasons)
  const z = num(raw, 'elevation', fmt, reasons)
  if (reasons.length) return { ok: false, reasons }
  return { ok: true, value: { id: objectId('point', name), name, e, n, z }, reasons: [] }
}

export function validateBorehole(raw: RawObject, fmt: NumberFormat, dip: DipConvention = 'negative-down'): ValidationResult<Borehole> {
  const reasons: string[] = []
  const name = nameOf(raw, reasons)
  const e = num(raw, 'easting', fmt, reasons)
  const n = num(raw, 'northing', fmt, reasons)
  const z = num(raw, 'elevation', fmt, reasons)
  const md = num(raw, 'depth', fmt, reasons)
  let az = num(raw, 'azimuth', fmt, reasons)
  let dp = num(raw, 'dip', fmt, reasons)
  if (Number.isFinite(md) && !(md > 0)) reasons.push(`Kedalaman (MD) harus > 0 m (diisi ${md})`)
  if (Number.isFinite(az) && (az < 0 || az > 360)) reasons.push(`Azimuth harus 0–360° (diisi ${az})`)
  // Konvensi "positif ke bawah" dibalik tepat sekali sebelum validasi dan pembentukan lintasan.
  if (Number.isFinite(dp) && dip === 'positive-down') dp = -dp
  if (Number.isFinite(dp) && (dp < -90 || dp > 90)) reasons.push(`Dip harus −90° sampai 90° (diisi ${dip === 'positive-down' ? -dp : dp})`)
  if (reasons.length) return { ok: false, reasons }
  if (az === 360) az = 0
  if (Object.is(dp, -0)) dp = 0
  return { ok: true, value: { id: objectId('borehole', name), name, collar: { e, n, z }, md, azDeg: az, dipDeg: dp }, reasons: [] }
}

// ---------- impor batch ----------

export type RowOutcome<T> = { line: number; cells: string[]; status: 'accepted' | 'rejected'; reasons: string[]; value?: T }

export type CsvImportPreview<T> = {
  kind: ObjectKind
  delimiter: ',' | ';'
  decimalComma: boolean
  bom: boolean
  dip: DipConvention
  header: string[]
  /** indeks kolom per field (null = tidak ditemukan). */
  mapping: Record<string, number | null>
  ignoredColumns: string[]
  rows: RowOutcome<T>[]
  accepted: T[]
  fatal: ValidationIssue | null
}

export function mapHeader(header: string[], kind: ObjectKind): { mapping: Record<string, number | null>; ignored: string[]; missing: Field[] } {
  const mapping: Record<string, number | null> = {}
  const used = new Set<number>()
  for (const f of FIELDS[kind]) {
    const idx = header.findIndex((h, i) => !used.has(i) && ALIASES[f].includes(normalizeHeader(h)))
    mapping[f] = idx >= 0 ? idx : null
    if (idx >= 0) used.add(idx)
  }
  const ignored = header.filter((_, i) => !used.has(i))
  const missing = FIELDS[kind].filter((f) => mapping[f] === null)
  return { mapping, ignored, missing }
}

/**
 * Pratinjau CSV: tidak mengubah state. `existingNames` = kunci nama yang sudah ada
 * di sesi untuk jenis yang sama (reimpor tidak menciptakan duplikat).
 */
export function previewCsv(
  text: string,
  kind: 'point',
  existingNames: Set<string>,
  opts?: { dip?: DipConvention; mapping?: Record<string, number | null> },
): CsvImportPreview<NamedPoint>
export function previewCsv(
  text: string,
  kind: 'borehole',
  existingNames: Set<string>,
  opts?: { dip?: DipConvention; mapping?: Record<string, number | null> },
): CsvImportPreview<Borehole>
export function previewCsv(
  text: string,
  kind: ObjectKind,
  existingNames: Set<string>,
  opts: { dip?: DipConvention; mapping?: Record<string, number | null> } = {},
): CsvImportPreview<NamedPoint | Borehole> {
  const table = parseCsv(text)
  const dip = opts.dip ?? 'negative-down'
  const header = table.header?.cells ?? []
  const decimalComma = table.delimiter === ';'
  const auto = mapHeader(header, kind)
  const mapping = opts.mapping ?? auto.mapping
  const missing = FIELDS[kind].filter((f) => mapping[f] === null || mapping[f] === undefined)
  const base = {
    kind, delimiter: table.delimiter, decimalComma, bom: table.bom, dip, header, mapping,
    ignoredColumns: header.filter((_, i) => !Object.values(mapping).includes(i)),
  }
  if (!table.header) {
    return { ...base, rows: [], accepted: [], fatal: { code: 'CSV_EMPTY', severity: 'error', message: 'Berkas CSV kosong.' } }
  }
  if (missing.length) {
    return {
      ...base, rows: [], accepted: [],
      fatal: { code: 'CSV_MISSING_COLUMNS', severity: 'error', message: `Kolom wajib tidak ditemukan: ${missing.map((f) => FIELD_LABEL[f]).join(', ')}. Atur pemetaan kolom.`, location: { line: 1 } },
    }
  }
  const seen = new Set(existingNames)
  const batch = new Set<string>()
  const rows: RowOutcome<NamedPoint | Borehole>[] = []
  const accepted: (NamedPoint | Borehole)[] = []
  const fmt = { decimalComma }
  for (const r of table.rows) {
    const raw: RawObject = {}
    for (const f of FIELDS[kind]) raw[f] = r.cells[mapping[f]!] ?? ''
    const v = kind === 'point' ? validatePoint(raw, fmt) : validateBorehole(raw, fmt, dip)
    if (!v.ok) {
      rows.push({ line: r.line, cells: r.cells, status: 'rejected', reasons: v.reasons })
      continue
    }
    const key = nameKey(v.value.name)
    if (batch.has(key)) {
      rows.push({ line: r.line, cells: r.cells, status: 'rejected', reasons: [`Nama "${v.value.name}" duplikat dengan baris sebelumnya`] })
      continue
    }
    if (seen.has(key)) {
      rows.push({ line: r.line, cells: r.cells, status: 'rejected', reasons: [`Nama "${v.value.name}" sudah ada di sesi`] })
      continue
    }
    batch.add(key)
    rows.push({ line: r.line, cells: r.cells, status: 'accepted', reasons: [], value: v.value })
    accepted.push(v.value)
  }
  return { ...base, rows, accepted, fatal: null }
}
