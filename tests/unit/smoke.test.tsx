// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { App } from '../../src/ui/App'

afterEach(cleanup)

// jsdom tidak menyediakan ResizeObserver; WebGL juga tidak tersedia (jalur gagal diuji).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

describe('smoke: halaman utama', () => {
  it('menampilkan empat tindakan utama', () => {
    render(<App />)
    for (const label of ['Buka surface', 'Tambah titik', 'Tambah bor', 'Buat penampang']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('tombol yang belum dapat dipakai menjelaskan prasyarat', () => {
    render(<App />)
    const btn = screen.getByRole('button', { name: 'Buat penampang' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.title).toMatch(/Buka surface/)
  })

  it('tanpa WebGL menampilkan pesan jelas, penampang 2D tetap tersedia', async () => {
    render(<App />)
    expect((await screen.findByTestId('webgl-warning')).textContent).toMatch(/WebGL tidak tersedia/)
    expect(screen.getByTestId('topview-overlay')).toBeTruthy()
  })
})
