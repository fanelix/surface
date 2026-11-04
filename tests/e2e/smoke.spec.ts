import { expect, test } from '@playwright/test'

test('halaman terbuka dengan tindakan utama', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: /Topografi/ })).toBeVisible()
  for (const label of ['Buka surface', 'Tambah titik', 'Tambah bor', 'Buat penampang']) {
    await expect(page.getByRole('button', { name: label }).first()).toBeVisible()
  }
  expect(errors).toEqual([])
})
