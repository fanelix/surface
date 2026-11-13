/**
 * Tolok ukur M7 — hanya berjalan bila BENCH=1 (tidak dijalankan di CI biasa).
 *
 *   npm run gen:bench && BENCH=1 npx playwright test tests/e2e/bench.spec.ts
 *
 * Impor diukur dari pemilihan berkas sampai frame pertama yang dapat diinteraksikan
 * (nilai aplikasi, data-import-ms). Profil diukur dari pelepasan pegangan B sampai
 * grafik terakhir muncul (data-profile-ms). Tiga pengulangan per dataset.
 * Hasil ditulis ke test-results/bench.json. Angka dari runner/container BUKAN
 * pengganti pengukuran pada laptop kerja target.
 */
import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'

const LARGE = join(process.cwd(), 'tests', 'fixtures', 'large')
const DATASETS = ['small_500kb.dxf', 'medium_5mb.dxf', 'large_25mb.dxf', 'large_50mb.dxf']
const REPS = 3

test.skip(!process.env.BENCH, 'Set BENCH=1 untuk menjalankan tolok ukur.')
test.setTimeout(600_000)

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!

test('tolok ukur impor dan pembaruan profil', async ({ page, browserName }) => {
  const results: Record<string, unknown>[] = []
  for (const name of DATASETS) {
    const file = join(LARGE, name)
    if (!existsSync(file)) throw new Error(`${file} belum ada; jalankan npm run gen:bench`)
    const importMs: number[] = []
    const profileMs: number[] = []
    let triangles = 0
    let heapMB: number | null = null
    for (let r = 0; r < REPS; r++) {
      await page.goto('/')
      await page.getByTestId('surface-input').setInputFiles(file)
      await expect(page.getByTestId('surface-summary')).toBeVisible({ timeout: 120_000 })
      const timing = page.getByTestId('timing')
      await expect(timing).toHaveAttribute('data-import-ms', /\d/, { timeout: 60_000 })
      importMs.push(Number(await timing.getAttribute('data-import-ms')))
      triangles = Number((await page.getByTestId('summary-triangles').textContent())!.replace(/\./g, ''))
      const c = page.getByTestId('confirm-meters')
      if (await c.isVisible()) await c.click()
      // garis diagonal melintasi seluruh mesh (grid 2 m, lebar = 2·√(segitiga/2))
      const size = 2 * Math.floor(Math.sqrt(triangles / 2))
      await page.getByTestId('a-e').fill(String(700000 - 5))
      await page.getByTestId('a-n').fill(String(9100000 + size * 0.1))
      await page.getByTestId('b-e').fill(String(700000 + size * 0.9))
      await page.getByTestId('b-n').fill(String(9100000 + size * 0.95))
      await page.getByTestId('apply-ab').click()
      await expect(page.locator('[data-testid=profile-part]').first()).toBeVisible({ timeout: 30_000 })
      await page.getByTestId('fit').click()
      await page.getByTestId('mode-edit').click()
      const hb = (await page.getByTestId('handle-b').boundingBox())!
      await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
      await page.mouse.down()
      await page.mouse.move(hb.x - 30, hb.y - 20, { steps: 15 })
      const before = await timing.getAttribute('data-profile-ms')
      await page.mouse.up()
      await expect.poll(async () => await timing.getAttribute('data-profile-ms'), { timeout: 30_000 }).not.toBe(before)
      profileMs.push(Number(await timing.getAttribute('data-profile-ms')))
      heapMB = await page.evaluate(() => {
        const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
        return m ? Math.round(m.usedJSHeapSize / 1e6) : null
      })
    }
    results.push({
      dataset: name,
      bytes: statSync(file).size,
      triangles,
      importMs,
      importMedianMs: median(importMs),
      importMaxMs: Math.max(...importMs),
      profileMs,
      profileMedianMs: median(profileMs),
      profileMaxMs: Math.max(...profileMs),
      heapAfterMB: heapMB,
    })
  }
  const env = {
    browser: `${browserName} ${page.context().browser()?.version()}`,
    cpu: os.cpus()[0]?.model,
    cores: os.cpus().length,
    ramGB: Math.round(os.totalmem() / 1e9),
    platform: `${os.platform()} ${os.release()}`,
    note: 'Lingkungan uji otomatis; bukan laptop kerja target.',
  }
  mkdirSync('test-results', { recursive: true })
  writeFileSync('test-results/bench.json', JSON.stringify({ env, results }, null, 2))
  console.log(JSON.stringify({ env, results }, null, 2))
  for (const r of results) {
    expect(r.importMedianMs as number).toBeLessThan(15_000)
    expect(r.profileMedianMs as number).toBeLessThan(1_000)
  }
})
