import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
export const FIXTURES = join(here, '..', 'fixtures', 'synthetic')

export function fixturePath(name: string): string {
  return join(FIXTURES, name)
}

export function readFixtureText(name: string): string {
  return readFileSync(fixturePath(name), 'utf8')
}

export function readFixtureBytes(name: string): Uint8Array {
  return new Uint8Array(readFileSync(fixturePath(name)))
}

export type Expected = {
  units: string
  id: string
  a: [number, number]
  b: [number, number]
  tolerance_m: number
  bench: {
    unique_vertex_count: number
    triangle_count: number
    bounds_ENZ: [[number, number, number], [number, number, number]]
    required_breakpoints_s_z: [number, number][]
  }
  gap: { triangle_count: number; profile_intervals_s: [number, number][] }
  points: Record<string, { s: number; offset: number; z: number }>
  boreholes: Record<
    string,
    {
      collar_s_o_z: [number, number, number]
      toe_s_o_z: [number, number, number]
      plane: 'cross' | 'in-plane' | 'none' | 'extension-cross'
      md_at_hit?: number
      hit_s_z?: [number, number]
    }
  >
  all_count: number
  corridor_half_width_5m: string[]
  points_invalid: { accepted_rows: number[]; rejected_rows: number[] }
}

export function loadExpected(): Expected {
  return JSON.parse(readFixtureText('expected.json')) as Expected
}

/** Pembaca CSV sederhana khusus tes (independen dari src/import/objects.ts). */
export function rawCsvRows(name: string): Record<string, string>[] {
  const lines = readFixtureText(name).split(/\r?\n/).filter((l) => l.trim() !== '')
  const header = lines[0]!.split(',')
  return lines.slice(1).map((l) => {
    const cells = l.split(',')
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']))
  })
}

/** File palsu untuk menguji batas byte tanpa mengalokasikan isi. */
export function fakeFile(name: string, size: number, content = '') {
  let reads = 0
  return {
    name,
    size,
    get reads() {
      return reads
    },
    text: async () => {
      reads++
      return content
    },
    arrayBuffer: async () => {
      reads++
      return new TextEncoder().encode(content).buffer as ArrayBuffer
    },
  }
}
