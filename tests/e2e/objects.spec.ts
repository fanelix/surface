import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { expected, fx, importCsv, loadSurface, openApp, setAB } from './helpers'

const E0 = 700000
const N0 = 9100000

async function setup(page: Page) {
  const errors = await openApp(page)
  await loadSurface(page, 'bench_3dface.dxf')
  await importCsv(page, 'points.csv', 'point')
  await importCsv(page, 'boreholes.csv', 'borehole')
  await setAB(page, [E0, N0], [E0 + 100, N0])
  await expect(page.locator('[data-testid=profile-part]')).toHaveCount(1)
  return errors
}

const visibleNames = (page: Page) =>
  page.locator('[data-testid=object-table] tbody tr').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.testid!.replace(/^row-/, '')))

test.describe('M6 · titik, bor, label, tabel sinkron', () => {
  test('kedua CSV, satu titik manual, satu bor manual; filter dan koridor', async ({ page }) => {
    const errors = await setup(page)
    // Sebelum penambahan manual: 9 objek valid, semua tampil (filter mati).
    await expect(page.getByTestId('count-valid')).toHaveText(String(expected.all_count))
    await expect(page.getByTestId('count-shown')).toHaveText('9')
    for (const n of ['P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'BH-01', 'BH-02', 'BH-03', 'BH-04']) {
      await expect(page.getByTestId(`sec-obj-${n}`)).toHaveCount(1)
    }
    // Koridor ±5 m → tepat 6 objek
    await page.getByTestId('corridor-width').fill('5')
    await page.getByTestId('corridor-enabled').check()
    await expect(page.getByTestId('count-shown')).toHaveText('6')
    expect((await visibleNames(page)).sort()).toEqual([...expected.corridor_half_width_5m].sort())
    await page.getByTestId('corridor-enabled').uncheck()

    // Titik manual (koma desimal Indonesia di formulir)
    await page.getByTestId('add-point').click()
    await page.getByTestId('point-name').fill('T-MAN')
    await page.getByTestId('point-easting').fill('700045,5')
    await page.getByTestId('point-northing').fill('9100003')
    await page.getByTestId('point-elevation').fill('0')
    await page.getByTestId('submit-point').click()
    // Bor manual
    await page.getByTestId('add-borehole').click()
    await page.getByTestId('borehole-name').fill('BH-MAN')
    await page.getByTestId('borehole-easting').fill('700070')
    await page.getByTestId('borehole-northing').fill('9100010')
    await page.getByTestId('borehole-elevation').fill('140')
    await page.getByTestId('borehole-depth').fill('30')
    await page.getByTestId('borehole-azimuth').fill('180')
    await page.getByTestId('borehole-dip').fill('-45')
    await page.getByTestId('submit-borehole').click()
    await expect(page.getByTestId('count-valid')).toHaveText('11')
    const man = page.getByTestId('row-T-MAN')
    await expect(man.locator('[data-col=s]')).toHaveText('45,50')
    await expect(man.locator('[data-col=o]')).toHaveText('3,00 m kiri')
    await expect(man.locator('[data-col=z]')).toHaveText('0,00')
    await expect(page.getByTestId('row-BH-MAN').locator('[data-col=hit]')).toContainText('memotong dalam A–B')
    expect(errors).toEqual([])
  })

  test('nilai tabel untuk titik dan bor sesuai expected.json', async ({ page }) => {
    await setup(page)
    const p02 = page.getByTestId('row-P-02')
    await expect(p02.locator('[data-col=s]')).toHaveText('-10,00')
    await expect(p02.locator('[data-col=o]')).toHaveText('4,00 m kiri')
    await expect(p02).toContainText('di perpanjangan')
    const bh1 = page.getByTestId('row-BH-01')
    await expect(bh1.locator('[data-col=o]')).toHaveText('12,00 m kiri')
    await expect(bh1.locator('[data-col=o-toe]')).toHaveText('8,00 m kanan')
    await expect(bh1.locator('[data-col=z-toe]')).toHaveText('99,36')
    await expect(bh1.locator('[data-col=hit]')).toContainText('MD 24,00 · s 50,00 · Z 113,22')
    await expect(page.getByTestId('row-BH-02').locator('[data-col=hit]')).toContainText('pada bidang')
    await expect(page.getByTestId('row-BH-03').locator('[data-col=hit]')).toContainText('tidak memotong bidang')
    await expect(page.getByTestId('row-BH-04').locator('[data-col=hit]')).toContainText('memotong di perpanjangan · MD 4,00 · s 110,00 · Z 139,00')
    await expect(page.getByTestId('sec-obj-BH-04').getByTestId('coincident-marker')).toHaveCount(1)
    await expect(page.getByTestId('sec-obj-BH-01').getByTestId('hit-marker')).toHaveCount(1)
    // Daerah di luar ujung garis diarsir
    await expect(page.getByTestId('hatch-before-a')).toHaveCount(1)
    await expect(page.getByTestId('hatch-after-b')).toHaveCount(1)
    // P-01 dan P-05 bertumpuk di grafik (s=30) tetapi tetap dua baris terpisah
    await expect(page.getByTestId('row-P-01')).toHaveCount(1)
    await expect(page.getByTestId('row-P-05')).toHaveCount(1)
  })

  test('seleksi tabel ↔ grafik sinkron dan membuka label lengkap', async ({ page }) => {
    await setup(page)
    await page.getByTestId('row-BH-01').click()
    await expect(page.getByTestId('row-BH-01')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('label-borehole:bh-01')).toContainText('MD 40,00')
    // Klik simbol P-05 di grafik memilih barisnya
    await page.getByTestId('sec-obj-P-05').locator('circle').click({ force: true })
    await expect(page.getByTestId('row-P-05')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('row-BH-01')).toHaveAttribute('aria-selected', 'false')
  })

  test('balik A/B memperbarui semua proyeksi dan tabel bersama', async ({ page }) => {
    await setup(page)
    await page.getByTestId('reverse-ab').click()
    await expect(page.getByTestId('row-P-01').locator('[data-col=s]')).toHaveText('70,00')
    await expect(page.getByTestId('row-P-01').locator('[data-col=o]')).toHaveText('10,00 m kiri')
    await expect(page.getByTestId('row-P-03').locator('[data-col=s]')).toHaveText('-10,00')
    await expect(page.getByTestId('row-BH-01').locator('[data-col=o]')).toHaveText('12,00 m kanan')
    await expect(page.getByTestId('row-BH-01').locator('[data-col=hit]')).toContainText('MD 24,00')
  })

  test('points_invalid.csv: pratinjau 1 diterima / 3 ditolak; Batal tidak mengubah state; reimpor tanpa duplikat', async ({ page }) => {
    await setup(page)
    await page.getByRole('radio', { name: 'Titik' }).check()
    await page.getByTestId('csv-input').setInputFiles(fx('points_invalid.csv'))
    await expect(page.getByTestId('csv-summary')).toContainText('Diterima 1, ditolak 3')
    await expect(page.getByTestId('csv-row-3')).toContainText('Northing kosong')
    await expect(page.getByTestId('csv-row-4')).toContainText('duplikat')
    await expect(page.getByTestId('csv-row-5')).toContainText('bukan angka')
    await page.getByTestId('csv-cancel').click()
    await expect(page.getByTestId('count-valid')).toHaveText('9')
    // Reimpor points.csv: semua baris ditolak sebagai sudah ada
    await page.getByTestId('csv-input').setInputFiles(fx('points.csv'))
    await expect(page.getByTestId('csv-summary')).toContainText('Diterima 0, ditolak 5')
    await expect(page.getByTestId('csv-apply')).toBeDisabled()
  })

  test('objek tetap diproyeksikan tanpa surface', async ({ page }) => {
    await openApp(page)
    await importCsv(page, 'points.csv', 'point')
    await expect(page.getByTestId('make-section')).toBeEnabled()
    await setAB(page, [E0, N0], [E0 + 100, N0])
    await expect(page.getByTestId('count-shown')).toHaveText('5')
    await expect(page.locator('[data-testid=profile-part]')).toHaveCount(0)
  })
})
