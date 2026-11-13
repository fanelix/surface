import type { ValidationIssue } from '../domain/types'

/**
 * Batas per berkas surface (byte). Dua berkas pasangan DTM/STR masing-masing boleh tepat sebesar ini.
 * Keputusan pemilik 2026-11-13: 50.000.000 byte (rencana awal 25.000.000), karena ekspor DXF 3D
 * site nyata berukuran 26.044.478 byte.
 */
export const MAX_SURFACE_BYTES = 50_000_000

export type FileLike = {
  name: string
  size: number
  text?: () => Promise<string>
  arrayBuffer: () => Promise<ArrayBuffer>
}

export type SurfaceFileKind = 'dxf' | 'dtm' | 'str' | 'unknown'

const fmt = new Intl.NumberFormat('id-ID')

function tooLarge(name: string, size: number): ValidationIssue {
  return {
    code: 'SURFACE_TOO_LARGE',
    severity: 'error',
    message: `Berkas "${name}" berukuran ${fmt.format(size)} byte, melebihi batas ${fmt.format(MAX_SURFACE_BYTES)} byte per berkas surface.`,
    location: { file: name },
  }
}

/** Pemeriksaan berbasis File.size; dipanggil SEBELUM isi dibaca. */
export function checkSurfaceSize(f: { name: string; size: number }): ValidationIssue | null {
  if (!Number.isFinite(f.size) || f.size < 0) {
    return { code: 'SURFACE_SIZE_UNKNOWN', severity: 'error', message: `Ukuran berkas "${f.name}" tidak dapat dibaca.`, location: { file: f.name } }
  }
  if (f.size > MAX_SURFACE_BYTES) return tooLarge(f.name, f.size)
  return null
}

export type ReadResult = { ok: true; name: string; bytes: Uint8Array } | { ok: false; name: string; issues: ValidationIssue[] }

/** Membaca isi hanya bila lolos batas ukuran; ukuran byte aktual diperiksa ulang. */
export async function readSurfaceFile(f: FileLike): Promise<ReadResult> {
  const pre = checkSurfaceSize(f)
  if (pre) return { ok: false, name: f.name, issues: [pre] }
  const buf = await f.arrayBuffer()
  if (buf.byteLength > MAX_SURFACE_BYTES) return { ok: false, name: f.name, issues: [tooLarge(f.name, buf.byteLength)] }
  if (buf.byteLength === 0) {
    return { ok: false, name: f.name, issues: [{ code: 'SURFACE_EMPTY', severity: 'error', message: `Berkas "${f.name}" kosong.`, location: { file: f.name } }] }
  }
  return { ok: true, name: f.name, bytes: new Uint8Array(buf) }
}

export function kindFromName(name: string): SurfaceFileKind {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'dxf') return 'dxf'
  if (ext === 'dtm') return 'dtm'
  if (ext === 'str') return 'str'
  return 'unknown'
}

/** Dekode teks: UTF-8 bila valid, selain itu windows-1252 (DXF R12 ANSI_1252). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

export function looksBinaryDxf(bytes: Uint8Array): boolean {
  const sig = 'AutoCAD Binary DXF'
  if (bytes.length < sig.length) return false
  for (let i = 0; i < sig.length; i++) if (bytes[i] !== sig.charCodeAt(i)) return false
  return true
}
