import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const FX = join(process.cwd(), 'tests', 'fixtures', 'synthetic')
export const fx = (name: string) => join(FX, name)
export const expected = JSON.parse(readFileSync(fx('expected.json'), 'utf8')) as {
  tolerance_m: number
  bench: { required_breakpoints_s_z: [number, number][] }
  gap: { profile_intervals_s: [number, number][] }
  corridor_half_width_5m: string[]
  all_count: number
}

export async function openApp(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: /Topografi/ })).toBeVisible()
  return errors
}

export async function loadSurface(page: Page, name: string) {
  await page.getByTestId('surface-input').setInputFiles(fx(name))
  await expect(page.getByTestId('surface-summary')).toContainText(name)
  const confirm = page.getByTestId('confirm-meters')
  if (await confirm.isVisible()) await confirm.click()
}

export async function importCsv(page: Page, name: string, kind: 'point' | 'borehole') {
  if (kind === 'borehole') await page.getByTestId('csv-kind-borehole').check()
  else await page.getByRole('radio', { name: 'Titik' }).check()
  await page.getByTestId('csv-input').setInputFiles(fx(name))
  await expect(page.getByTestId('csv-preview')).toBeVisible()
  await page.getByTestId('csv-apply').click()
}

export async function setAB(page: Page, a: [number, number], b: [number, number]) {
  await page.getByTestId('a-e').fill(String(a[0]))
  await page.getByTestId('a-n').fill(String(a[1]))
  await page.getByTestId('b-e').fill(String(b[0]))
  await page.getByTestId('b-n').fill(String(b[1]))
  await page.getByTestId('apply-ab').click()
}

type AB = { a: { e: number; n: number }; b: { e: number; n: number } }

/**
 * Nilai A/B yang ditampilkan UI. Input E/N diperbarui lewat efek React satu frame setelah aksi,
 * jadi tunggu dua frame lalu baca keempat input sekaligus (bukan satu per satu dengan await,
 * yang dapat terbelah oleh render dan mencampur nilai lama/baru).
 */
export async function readAB(page: Page): Promise<AB> {
  return page.evaluate(
    () =>
      new Promise<AB>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const v = (id: string) => Number((document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement).value)
            resolve({ a: { e: v('a-e'), n: v('a-n') }, b: { e: v('b-e'), n: v('b-n') } })
          }),
        ),
      ),
  )
}

export async function profileParts(page: Page): Promise<[number, number][][]> {
  return page.locator('[data-testid=profile-part]').evaluateAll((els) => els.map((e) => JSON.parse((e as HTMLElement).dataset.vertices!)))
}

export function zAt(parts: [number, number][][], s: number): number | null {
  for (const p of parts) for (let i = 0; i + 1 < p.length; i++) {
    const [s0, z0] = p[i]!, [s1, z1] = p[i + 1]!
    if (s >= s0 - 1e-6 && s <= s1 + 1e-6) return z0 + ((s - s0) / (s1 - s0 || 1)) * (z1 - z0)
  }
  return null
}

/** Pemetaan layar↔dunia dari atribut overlay tampak atas (nilai aktual UI). */
export async function topMapping(page: Page) {
  const ov = page.getByTestId('topview-overlay')
  const box = (await ov.boundingBox())!
  const mpp = Number(await ov.getAttribute('data-mpp'))
  const ce = Number(await ov.getAttribute('data-center-e'))
  const cn = Number(await ov.getAttribute('data-center-n'))
  return {
    box,
    toScreen: (e: number, n: number) => ({ x: box.x + box.width / 2 + (e - ce) / mpp, y: box.y + box.height / 2 - (n - cn) / mpp }),
    mpp,
  }
}
