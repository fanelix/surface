// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { App } from '../../src/ui/App'

afterEach(cleanup)

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
})
