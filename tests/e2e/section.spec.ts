import { expect, test } from '@playwright/test'
import { expected, fx, loadSurface, openApp, profileParts, readAB, setAB, topMapping, zAt } from './helpers'

const E0 = 700000
const N0 = 9100000
const TOL = expected.tolerance_m

test.describe('M5 · penampang dari surface DXF', () => {
  test('impor fixture, ringkasan, dan konfirmasi unit', async ({ page }) => {
    const errors = await openApp(page)
    await expect(page.getByTestId('make-section')).toBeDisabled()
    await page.getByTestId('surface-input').setInputFiles(fx('bench_polyface.dxf'))
    await expect(page.getByTestId('summary-triangles')).toHaveText('10')
    await expect(page.getByTestId('summary-layer')).toHaveText('TOPO')
    await expect(page.getByTestId('summary-units')).toContainText('tanpa unit')
    await expect(page.getByTestId('make-section')).toBeDisabled()
    await page.getByTestId('confirm-meters').click()
    await expect(page.getByTestId('make-section')).toBeEnabled()
    expect(errors).toEqual([])
  })

  test('E/N presisi: profil bench sesuai expected.json, sumbu & skala 1:1', async ({ page }) => {
    await openApp(page)
    await loadSurface(page, 'bench_3dface.dxf')
    await setAB(page, [E0, N0], [E0 + 100, N0])
    await expect(page.locator('[data-testid=profile-part]')).toHaveCount(1)
    const parts = await profileParts(page)
    expect(parts[0]![0]![0]).toBeCloseTo(0, 3)
    expect(parts[0]!.at(-1)![0]).toBeCloseTo(100, 3)
    for (const [s, z] of expected.bench.required_breakpoints_s_z) {
      expect(Math.abs(zAt(parts, s)! - z)).toBeLessThanOrEqual(TOL)
    }
    await expect(page.getByTestId('section-scale')).toContainText('1:1')
    await expect(page.getByTestId('ab-info')).toContainText('Panjang 100,00 m')
  })

  test('gambar A lalu B dengan dua klik, lalu tarik A→B (drag tidak dihitung klik)', async ({ page }) => {
    await openApp(page)
    await loadSurface(page, 'bench_3dface.dxf')
    await page.getByTestId('make-section').click()
    const m = await topMapping(page)
    const a = m.toScreen(E0 + 5, N0 + 2)
    const b = m.toScreen(E0 + 95, N0 - 3)
    await page.mouse.click(a.x, a.y)
    await expect(page.getByTestId('pending-a')).toBeVisible()
    await page.mouse.click(b.x, b.y)
    await expect(page.getByTestId('pending-a')).toHaveCount(0)
    const ab = await readAB(page)
    expect(Math.abs(ab.a.e - (E0 + 5))).toBeLessThan(m.mpp * 1.5)
    expect(Math.abs(ab.b.n - (N0 - 3))).toBeLessThan(m.mpp * 1.5)
    // L di grafik = L dari nilai A/B aktual di UI
    const L = Math.hypot(ab.b.e - ab.a.e, ab.b.n - ab.a.n)
    expect(Number(await page.getByTestId('section-svg').getAttribute('data-length'))).toBeCloseTo(L, 4)
    await expect(page.locator('[data-testid=profile-part]')).toHaveCount(1)

    // Drag A→B dalam mode gambar
    await page.getByTestId('mode-draw').click()
    const m2 = await topMapping(page)
    const p0 = m2.toScreen(E0 + 10, N0 + 10)
    const p1 = m2.toScreen(E0 + 90, N0 + 10)
    await page.mouse.move(p0.x, p0.y)
    await page.mouse.down()
    await page.mouse.move((p0.x + p1.x) / 2, p0.y, { steps: 5 })
    await page.mouse.move(p1.x, p1.y, { steps: 5 })
    await page.mouse.up()
    await expect(page.getByTestId('pending-a')).toHaveCount(0)
    const ab2 = await readAB(page)
    expect(Math.abs(ab2.a.e - (E0 + 10))).toBeLessThan(m2.mpp * 1.5)
    expect(Math.abs(ab2.b.e - (E0 + 90))).toBeLessThan(m2.mpp * 1.5)
    await expect(page.getByTestId('mode-edit')).toHaveAttribute('aria-pressed', 'true')
  })

  test('geser B, balik arah, dan batalkan (Esc) memakai nilai A/B aktual', async ({ page }) => {
    await openApp(page)
    await loadSurface(page, 'bench_3dface.dxf')
    await setAB(page, [E0, N0], [E0 + 100, N0])
    await expect(page.locator('[data-testid=profile-part]')).toHaveCount(1)
    await page.getByTestId('mode-edit').click()

    // Geser B ke utara-barat
    const hb = (await page.getByTestId('handle-b').boundingBox())!
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2)
    await page.mouse.down()
    await page.mouse.move(hb.x + hb.width / 2 - 40, hb.y + hb.height / 2 - 30, { steps: 10 })
    await page.mouse.up()
    const ab = await readAB(page)
    expect(ab.a).toEqual({ e: E0, n: N0 })
    expect(ab.b.e).toBeLessThan(E0 + 100)
    expect(ab.b.n).toBeGreaterThan(N0)
    const L = Math.hypot(ab.b.e - ab.a.e, ab.b.n - ab.a.n)
    await expect.poll(async () => Number(await page.getByTestId('section-svg').getAttribute('data-length'))).toBeCloseTo(L, 4)
    const info = page.getByTestId('ab-info')
    expect(Number(await info.getAttribute('data-length'))).toBeCloseTo(L, 6)

    // Balik A/B: E/N tertukar, profil terbalik (s′ = L − s)
    const before = await profileParts(page)
    await page.getByTestId('reverse-ab').click()
    await expect.poll(() => readAB(page)).toEqual({ a: ab.b, b: ab.a })
    const rev = await readAB(page)
    await expect.poll(async () => (await profileParts(page))[0]?.[0]?.[1]).toBeCloseTo(before[0]!.at(-1)![1], 3)

    // Esc di tengah drag membatalkan perubahan sementara
    const ha = (await page.getByTestId('handle-a').boundingBox())!
    await page.mouse.move(ha.x + ha.width / 2, ha.y + ha.height / 2)
    await page.mouse.down()
    await page.mouse.move(ha.x + 60, ha.y + 50, { steps: 6 })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect.poll(() => readAB(page)).toEqual(rev)
  })

  test('fixture gap: dua bagian profil [0,40] dan [55,100]', async ({ page }) => {
    await openApp(page)
    await loadSurface(page, 'gap_3dface.dxf')
    await setAB(page, [E0, N0], [E0 + 100, N0])
    await expect(page.locator('[data-testid=profile-part]')).toHaveCount(2)
    const parts = await profileParts(page)
    parts.forEach((p, i) => {
      expect(Math.abs(p[0]![0] - expected.gap.profile_intervals_s[i]![0])).toBeLessThanOrEqual(TOL)
      expect(Math.abs(p.at(-1)![0] - expected.gap.profile_intervals_s[i]![1])).toBeLessThanOrEqual(TOL)
    })
    expect(zAt(parts, 47)).toBeNull()
  })

  test('A–B di luar surface: pesan "Tidak ada perpotongan topografi"', async ({ page }) => {
    await openApp(page)
    await loadSurface(page, 'bench_3dface.dxf')
    await setAB(page, [E0, N0 + 500], [E0 + 100, N0 + 500])
    await expect(page.getByTestId('no-topo')).toHaveText('Tidak ada perpotongan topografi')
    await expect(page.locator('[data-testid=profile-part]')).toHaveCount(0)
  })

  test('A=B ditolak dengan pesan untuk memindahkan B', async ({ page }) => {
    await openApp(page)
    await loadSurface(page, 'bench_3dface.dxf')
    await setAB(page, [E0, N0], [E0, N0])
    await expect(page.getByTestId('ab-error')).toContainText('Pindahkan B')
  })

  test('impor baru yang gagal tidak merusak surface aktif', async ({ page }) => {
    await openApp(page)
    await loadSurface(page, 'bench_3dface.dxf')
    await setAB(page, [E0, N0], [E0 + 100, N0])
    await page.getByTestId('surface-input').setInputFiles({ name: 'rusak.dxf', mimeType: 'application/dxf', buffer: Buffer.from('name,easting\nP,1\n') })
    await expect(page.getByTestId('import-error')).toContainText('DXF_NOT_DXF')
    await expect(page.getByTestId('surface-summary')).toContainText('bench_3dface.dxf')
    await expect(page.locator('[data-testid=profile-part]')).toHaveCount(1)
  })

  test('impor tidak mengirim isi berkas keluar (hanya aset statis same-origin)', async ({ page, baseURL }) => {
    const requests: { url: string; method: string; post: string | null }[] = []
    page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), post: r.postData() }))
    await openApp(page)
    await loadSurface(page, 'bench_3dface.dxf')
    await setAB(page, [E0, N0], [E0 + 100, N0])
    await expect(page.locator('[data-testid=profile-part]')).toHaveCount(1)
    const origin = new URL(baseURL!).origin
    for (const r of requests) {
      expect(r.method, r.url).toBe('GET')
      expect(r.post).toBeNull()
      expect(new URL(r.url).origin === origin || r.url.startsWith('data:') || r.url.startsWith('blob:'), r.url).toBe(true)
      expect(r.url).not.toContain('700000')
    }
  })
})

test.describe('M5 · render 3D (dipisah dari tes geometri)', () => {
  test('WebGL menggambar mesh pada canvas', async ({ page }) => {
    await openApp(page)
    await loadSurface(page, 'bench_3dface.dxf')
    const warn = page.getByTestId('webgl-warning')
    if (await warn.isVisible()) {
      test.info().annotations.push({ type: 'webgl', description: (await warn.textContent()) ?? '' })
      test.skip(true, 'WebGL tidak tersedia di browser uji; status render 3D dicatat terpisah.')
    }
    await page.getByTestId('view-orbit').click()
    await page.waitForTimeout(300)
    // Buffer WebGL tidak dipertahankan; ambil piksel hasil komposisi lewat screenshot elemen.
    const png = await page.locator('canvas.terrain-canvas').screenshot()
    const colored = await page.evaluate(async (b64) => {
      const img = new Image()
      img.src = `data:image/png;base64,${b64}`
      await img.decode()
      const off = document.createElement('canvas')
      off.width = img.width
      off.height = img.height
      const g = off.getContext('2d')!
      g.drawImage(img, 0, 0)
      const d = g.getImageData(0, 0, off.width, off.height).data
      let n = 0
      for (let i = 0; i < d.length; i += 16) {
        // latar #f7f9fb; hitung piksel yang jelas berbeda (mesh berwarna elevasi)
        if (Math.abs(d[i]! - 247) + Math.abs(d[i + 1]! - 249) + Math.abs(d[i + 2]! - 251) > 40) n++
      }
      return n
    }, png.toString('base64'))
    expect(colored).toBeGreaterThan(200)
  })
})

test('Batal di tengah gambar klik-klik menghapus A sementara tanpa mengubah garis aktif', async ({ page }) => {
  await openApp(page)
  await loadSurface(page, 'bench_3dface.dxf')
  await setAB(page, [E0, N0], [E0 + 100, N0])
  const before = await readAB(page)
  await page.getByTestId('mode-draw').click()
  const m = await topMapping(page)
  const a = m.toScreen(E0 + 20, N0 + 15)
  await page.mouse.click(a.x, a.y)
  await expect(page.getByTestId('pending-a')).toHaveCount(0) // garis aktif tetap tampil; A sementara disimpan
  const b = m.toScreen(E0 + 60, N0 - 10)
  await page.mouse.move(b.x, b.y, { steps: 3 })
  await page.getByTestId('cancel-ab').click()
  await expect.poll(() => readAB(page)).toEqual(before)
  await expect(page.getByTestId('mode-navigate')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-testid=ab-line] line')).not.toHaveAttribute('stroke-dasharray', /.+/)
})

test('M3 · pasangan DTM + STR (dipilih sekaligus) menghasilkan profil bench yang sama dengan DXF', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('surface-input').setInputFiles([fx('surpac/bench.str'), fx('surpac/bench.dtm')])
  await expect(page.getByTestId('summary-triangles')).toHaveText('10')
  await expect(page.getByTestId('summary-layer')).toHaveText('OBJECT 1 / TRISOLATION 1')
  await expect(page.getByTestId('surface-summary')).toContainText('bench.dtm + bench.str')
  await expect(page.getByTestId('summary-units')).toContainText('tanpa unit')
  await expect(page.getByTestId('unit-confirm')).toContainText('DTM/STR Surpac tidak menyatakan unit')
  await page.getByTestId('confirm-meters').click()
  await setAB(page, [E0, N0], [E0 + 100, N0])
  await expect(page.locator('[data-testid=profile-part]')).toHaveCount(1)
  const parts = await profileParts(page)
  for (const [s, z] of expected.bench.required_breakpoints_s_z) {
    expect(Math.abs(zAt(parts, s)! - z)).toBeLessThanOrEqual(TOL)
  }
})

test('M3 · DTM tanpa STR pasangan → pesan "Pilih STR pasangan"', async ({ page }) => {
  await openApp(page)
  await page.getByTestId('surface-input').setInputFiles(fx('surpac/bench.dtm'))
  await expect(page.getByTestId('import-error')).toContainText('Pilih STR pasangan')
})
