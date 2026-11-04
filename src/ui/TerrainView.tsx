import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { Borehole, Bounds3, NamedPoint, Section, XY } from '../domain/types'
import type { RenderOrigin, TopView } from '../domain/coordinates'
import { fitTopView, screenToWorldTop, worldToRender, worldToScreenTop } from '../domain/coordinates'
import { boreholeToe } from '../geometry/borehole'
import type { RenderBuffers } from '../worker/protocol'

export type InteractionMode = 'navigate' | 'draw' | 'edit'
export type ViewMode = 'top' | 'orbit'

type Props = {
  render: RenderBuffers | null
  bounds: Bounds3 | null
  points: NamedPoint[]
  holes: Borehole[]
  section: Section | null
  mode: InteractionMode
  viewMode: ViewMode
  selectedId: string | null
  fitToken: number
  wireframe: boolean
  onSelect: (id: string | null) => void
  onDraft: (s: Section | null) => void
  onCommit: (s: Section) => void
  onWebglStatus: (ok: boolean, message?: string) => void
}

const CLICK_PX = 4
const HANDLE_PX = 12

function elevationColor(t: number): [number, number, number] {
  // hijau tua → kuning → coklat → putih
  const stops: [number, number, number, number][] = [
    [0, 0.18, 0.45, 0.25],
    [0.4, 0.75, 0.72, 0.35],
    [0.75, 0.55, 0.38, 0.22],
    [1, 0.95, 0.95, 0.95],
  ]
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!, b = stops[i]!
    if (t <= b[0]) {
      const f = (t - a[0]) / (b[0] - a[0])
      return [a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]), a[3] + f * (b[3] - a[3])]
    }
  }
  return [1, 1, 1]
}

type Gesture =
  | { kind: 'pan'; startPx: { x: number; y: number }; startCenter: XY }
  | { kind: 'handle'; which: 'a' | 'b'; base: Section }
  | { kind: 'draw'; startPx: { x: number; y: number }; startWorld: XY; moved: boolean }

export function TerrainView(p: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const three = useRef<{
    renderer: THREE.WebGLRenderer
    labels: CSS2DRenderer
    scene: THREE.Scene
    ortho: THREE.OrthographicCamera
    persp: THREE.PerspectiveCamera
    controls: OrbitControls
    surface: THREE.Group
    objects: THREE.Group
    sectionGroup: THREE.Group
    invalidate: () => void
  } | null>(null)
  const [size, setSize] = useState({ w: 800, h: 500 })
  const [top, setTop] = useState<TopView>({ center: { e: 0, n: 0 }, mpp: 1, width: 800, height: 500 })
  const topRef = useRef(top)
  topRef.current = top
  const [pendingA, setPendingA] = useState<XY | null>(null)
  const [hover, setHover] = useState<XY | null>(null)
  const [draft, setDraft] = useState<Section | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const [northAngle, setNorthAngle] = useState(0)
  const [webglOk, setWebglOk] = useState(true)
  const onWebglStatus = p.onWebglStatus
  const modeRef = useRef(p.viewMode)
  modeRef.current = p.viewMode

  const origin: RenderOrigin = useMemo(() => {
    if (p.render) return p.render.origin
    const pts = [...p.points, ...p.holes.map((h) => h.collar)]
    if (pts.length) {
      const e = pts.reduce((s, q) => s + q.e, 0) / pts.length
      const n = pts.reduce((s, q) => s + q.n, 0) / pts.length
      const z = pts.reduce((s, q) => s + q.z, 0) / pts.length
      return { e0: e, n0: n, z0: z }
    }
    if (p.section) return { e0: p.section.a.e, n0: p.section.a.n, z0: 0 }
    return { e0: 0, n0: 0, z0: 0 }
  }, [p.render, p.points, p.holes, p.section])

  // ---------- inisialisasi Three.js ----------
  useEffect(() => {
    const canvas = canvasRef.current!
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
      if (!renderer.getContext()) throw new Error('konteks WebGL kosong')
    } catch (err) {
      setWebglOk(false)
      onWebglStatus(false, `WebGL tidak tersedia (${(err as Error).message}). Tampilan 3D dimatikan; tampak atas untuk garis A–B dan penampang 2D tetap berfungsi.`)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0xf7f9fb)
    const labels = new CSS2DRenderer({ element: labelRef.current! })
    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const sun = new THREE.DirectionalLight(0xffffff, 1.1)
    sun.position.set(0.4, 1, 0.3)
    scene.add(sun)
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1e7)
    ortho.up.set(0, 0, -1)
    const persp = new THREE.PerspectiveCamera(45, 1, 0.1, 1e7)
    const controls = new OrbitControls(persp, canvas)
    controls.enableDamping = false
    const surface = new THREE.Group()
    const objects = new THREE.Group()
    const sectionGroup = new THREE.Group()
    scene.add(surface, objects, sectionGroup)
    let raf = 0
    const draw = () => {
      raf = 0
      const cam = modeRef.current === 'top' ? ortho : persp
      renderer.render(scene, cam)
      labels.render(scene, cam)
      if (modeRef.current === 'orbit') {
        // panah utara: arah layar dari vektor (0,0,−1) render
        const c = controls.target.clone()
        const a = c.clone().project(persp)
        const b = c.clone().add(new THREE.Vector3(0, 0, -1)).project(persp)
        setNorthAngle((Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI)
      } else setNorthAngle(0)
    }
    const invalidate = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    controls.addEventListener('change', invalidate)
    three.current = { renderer, labels, scene, ortho, persp, controls, surface, objects, sectionGroup, invalidate }
    onWebglStatus(true)
    return () => {
      cancelAnimationFrame(raf)
      controls.dispose()
      renderer.dispose()
      three.current = null
    }
  }, [onWebglStatus])

  // ---------- ukuran ----------
  useEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(([e]) => {
      if (!e) return
      const w = Math.max(100, Math.floor(e.contentRect.width))
      const h = Math.max(100, Math.floor(e.contentRect.height))
      setSize({ w, h })
      setTop((t) => ({ ...t, width: w, height: h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const t = three.current
    if (!t) return
    t.renderer.setSize(size.w, size.h, false)
    t.labels.setSize(size.w, size.h)
    t.persp.aspect = size.w / size.h
    t.persp.updateProjectionMatrix()
    t.invalidate()
  }, [size])

  // ---------- fit ----------
  const extent = useMemo(() => {
    let minE = Infinity, minN = Infinity, maxE = -Infinity, maxN = -Infinity, minZ = Infinity, maxZ = -Infinity
    const add = (e: number, n: number, z?: number) => {
      minE = Math.min(minE, e); maxE = Math.max(maxE, e); minN = Math.min(minN, n); maxN = Math.max(maxN, n)
      if (z !== undefined) { minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z) }
    }
    if (p.bounds) {
      add(p.bounds.min.e, p.bounds.min.n, p.bounds.min.z)
      add(p.bounds.max.e, p.bounds.max.n, p.bounds.max.z)
    }
    for (const q of p.points) add(q.e, q.n, q.z)
    for (const h of p.holes) {
      add(h.collar.e, h.collar.n, h.collar.z)
      const t = boreholeToe(h)
      add(t.e, t.n, t.z)
    }
    if (p.section) {
      add(p.section.a.e, p.section.a.n)
      add(p.section.b.e, p.section.b.n)
    }
    if (!Number.isFinite(minE)) return null
    if (!Number.isFinite(minZ)) { minZ = 0; maxZ = 1 }
    return { minE, minN, maxE, maxN, minZ, maxZ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.bounds, p.points, p.holes, p.fitToken])

  const fit = useCallback(() => {
    if (!extent) return
    setTop((t) => fitTopView(extent.minE, extent.minN, extent.maxE, extent.maxN, t.width, t.height))
    const th = three.current
    if (th) {
      const c = worldToRender({ e: (extent.minE + extent.maxE) / 2, n: (extent.minN + extent.maxN) / 2, z: (extent.minZ + extent.maxZ) / 2 }, origin)
      const r = Math.max(extent.maxE - extent.minE, extent.maxN - extent.minN, extent.maxZ - extent.minZ, 10)
      th.controls.target.set(c[0], c[1], c[2])
      th.persp.position.set(c[0] + r * 0.8, c[1] + r * 0.9, c[2] + r * 1.1)
      th.persp.near = r / 1000
      th.persp.far = r * 100
      th.persp.updateProjectionMatrix()
      th.controls.update()
      th.invalidate()
    }
  }, [extent, origin])

  // Fit otomatis saat surface berubah dan atas permintaan tombol Fit.
  const fitKey = `${p.render ? p.render.positions.length : 0}:${p.fitToken}:${size.w > 100 ? 1 : 0}`
  const lastFit = useRef('')
  useEffect(() => {
    if (lastFit.current === fitKey) return
    lastFit.current = fitKey
    fit()
  }, [fitKey, fit])

  // ---------- kamera tampak atas ----------
  useEffect(() => {
    const t = three.current
    if (!t) return
    const c = worldToRender({ e: top.center.e, n: top.center.n, z: 0 }, origin)
    const zTop = (extent?.maxZ ?? 1000) - origin.z0 + 1000
    t.ortho.position.set(c[0], zTop, c[2])
    t.ortho.lookAt(c[0], zTop - 1, c[2])
    t.ortho.left = (-top.width / 2) * top.mpp
    t.ortho.right = (top.width / 2) * top.mpp
    t.ortho.top = (top.height / 2) * top.mpp
    t.ortho.bottom = (-top.height / 2) * top.mpp
    t.ortho.near = 0.01
    t.ortho.far = zTop + Math.max(1e4, (extent?.maxZ ?? 0) - (extent?.minZ ?? 0) + 2000)
    t.ortho.updateProjectionMatrix()
    t.controls.enabled = p.viewMode === 'orbit'
    t.invalidate()
  }, [top, origin, extent, p.viewMode])

  // ---------- mesh ----------
  useEffect(() => {
    const t = three.current
    if (!t) return
    t.surface.clear()
    if (p.render && p.bounds) {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(p.render.positions, 3))
      g.setIndex(new THREE.BufferAttribute(p.render.indices, 1))
      g.computeVertexNormals()
      const n = p.render.positions.length / 3
      const col = new Float32Array(n * 3)
      const zr = Math.max(p.bounds.max.z - p.bounds.min.z, 1e-6)
      for (let i = 0; i < n; i++) {
        const z = p.render.positions[i * 3 + 1]! + p.render.origin.z0
        const [r, gg, b] = elevationColor((z - p.bounds.min.z) / zr)
        col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3))
      t.surface.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })))
      if (p.wireframe) {
        t.surface.add(new THREE.LineSegments(new THREE.WireframeGeometry(g), new THREE.LineBasicMaterial({ color: 0x3a4a3a, transparent: true, opacity: 0.35 })))
      }
    }
    t.invalidate()
  }, [p.render, p.bounds, p.wireframe])

  // ---------- objek 3D ----------
  useEffect(() => {
    const t = three.current
    if (!t) return
    for (const c of [...t.objects.children]) {
      c.traverse((o) => { if (o instanceof CSS2DObject) o.element.remove() })
    }
    t.objects.clear()
    const r = extent ? Math.max(extent.maxE - extent.minE, extent.maxN - extent.minN, 10) * 0.007 : 1
    const sphere = new THREE.SphereGeometry(r, 12, 8)
    const label = (text: string, sel: boolean) => {
      const d = document.createElement('div')
      d.className = sel ? 'label3d sel' : 'label3d'
      d.textContent = text
      return new CSS2DObject(d)
    }
    const showLabels = p.viewMode === 'orbit'
    for (const q of p.points) {
      const sel = q.id === p.selectedId
      const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: sel ? 0xd1242f : 0x1f6feb }))
      m.position.set(...worldToRender(q, origin))
      if (showLabels) {
        const l = label(q.name, sel)
        l.position.set(0, r * 2, 0)
        m.add(l)
      }
      t.objects.add(m)
    }
    for (const h of p.holes) {
      const sel = h.id === p.selectedId
      const color = sel ? 0xd1242f : 0x6e40c9
      const c = worldToRender(h.collar, origin)
      const toe = worldToRender(boreholeToe(h), origin)
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...c), new THREE.Vector3(...toe)])
      t.objects.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color })))
      const m = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color }))
      m.position.set(...c)
      if (showLabels) {
        const l = label(h.name, sel)
        l.position.set(0, r * 2, 0)
        m.add(l)
      }
      t.objects.add(m)
      const tm = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color }))
      tm.scale.setScalar(0.6)
      tm.position.set(...toe)
      t.objects.add(tm)
    }
    t.invalidate()
  }, [p.points, p.holes, p.selectedId, origin, extent, p.viewMode])

  // ---------- bidang penampang di 3D ----------
  const shownSection = draft ?? p.section
  useEffect(() => {
    const t = three.current
    if (!t) return
    t.sectionGroup.clear()
    if (shownSection && extent) {
      const z0 = extent.minZ - 5, z1 = extent.maxZ + 5
      const a0 = worldToRender({ ...shownSection.a, z: z0 }, origin), a1 = worldToRender({ ...shownSection.a, z: z1 }, origin)
      const b0 = worldToRender({ ...shownSection.b, z: z0 }, origin), b1 = worldToRender({ ...shownSection.b, z: z1 }, origin)
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...a0, ...b0, ...b1, ...a0, ...b1, ...a1]), 3))
      t.sectionGroup.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xd1242f, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })))
      const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a1), new THREE.Vector3(...b1)])
      t.sectionGroup.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xd1242f })))
    }
    t.invalidate()
  }, [shownSection, extent, origin])

  useEffect(() => {
    three.current?.invalidate()
  }, [p.viewMode])

  // ---------- interaksi tampak atas ----------
  const pxOf = (e: React.PointerEvent | React.WheelEvent) => {
    const r = (e.currentTarget as Element).getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const setDraftBoth = (s: Section | null) => {
    setDraft(s)
    p.onDraft(s)
  }

  const cancelTemp = useCallback(() => {
    gesture.current = null
    setPendingA(null)
    setDraft(null)
    p.onDraft(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.onDraft])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelTemp()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [cancelTemp])

  useEffect(() => {
    // Ganti mode membatalkan gambar setengah jadi dan pratinjau sementara.
    gesture.current = null
    setPendingA(null)
    setDraft(null)
  }, [p.mode])

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const px = pxOf(e)
    const w = screenToWorldTop(topRef.current, px.x, px.y)
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    if (p.mode === 'edit' && p.section) {
      for (const which of ['a', 'b'] as const) {
        const sp = worldToScreenTop(topRef.current, p.section[which])
        if (Math.hypot(sp.x - px.x, sp.y - px.y) <= HANDLE_PX) {
          gesture.current = { kind: 'handle', which, base: p.section }
          return
        }
      }
    }
    if (p.mode === 'draw') {
      gesture.current = { kind: 'draw', startPx: px, startWorld: w, moved: false }
      return
    }
    gesture.current = { kind: 'pan', startPx: px, startCenter: topRef.current.center }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const px = pxOf(e)
    const w = screenToWorldTop(topRef.current, px.x, px.y)
    setHover(w)
    const g = gesture.current
    if (!g) {
      if (p.mode === 'draw' && pendingA) setDraftBoth({ a: pendingA, b: w })
      return
    }
    if (g.kind === 'pan') {
      const t = topRef.current
      setTop({ ...t, center: { e: g.startCenter.e - (px.x - g.startPx.x) * t.mpp, n: g.startCenter.n + (px.y - g.startPx.y) * t.mpp } })
    } else if (g.kind === 'handle') {
      setDraftBoth(g.which === 'a' ? { a: w, b: g.base.b } : { a: g.base.a, b: w })
    } else if (g.kind === 'draw') {
      if (!g.moved && Math.hypot(px.x - g.startPx.x, px.y - g.startPx.y) > CLICK_PX) g.moved = true
      if (g.moved) setDraftBoth({ a: g.startWorld, b: w })
    }
  }

  const finish = (s: Section) => {
    gesture.current = null
    setPendingA(null)
    setDraft(null)
    p.onCommit(s)
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gesture.current
    if (!g) return
    const px = pxOf(e)
    const w = screenToWorldTop(topRef.current, px.x, px.y)
    if (g.kind === 'handle') {
      finish(g.which === 'a' ? { a: w, b: g.base.b } : { a: g.base.a, b: w })
      return
    }
    if (g.kind === 'draw') {
      gesture.current = null
      if (g.moved) {
        finish({ a: g.startWorld, b: w })
        return
      }
      // klik (bukan drag)
      if (!pendingA) {
        setPendingA(g.startWorld)
        setDraftBoth(null)
      } else finish({ a: pendingA, b: g.startWorld })
      return
    }
    if (g.kind === 'pan') {
      const moved = Math.hypot(px.x - g.startPx.x, px.y - g.startPx.y) > CLICK_PX
      gesture.current = null
      if (!moved) {
        // klik navigasi: pilih objek terdekat dalam 8 px
        let best: { id: string; d: number } | null = null
        for (const q of p.points) {
          const sp = worldToScreenTop(topRef.current, q)
          const d = Math.hypot(sp.x - px.x, sp.y - px.y)
          if (d < 8 && (!best || d < best.d)) best = { id: q.id, d }
        }
        for (const h of p.holes) {
          const sp = worldToScreenTop(topRef.current, h.collar)
          const d = Math.hypot(sp.x - px.x, sp.y - px.y)
          if (d < 8 && (!best || d < best.d)) best = { id: h.id, d }
        }
        p.onSelect(best?.id ?? null)
      }
    }
  }

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const px = pxOf(e)
    const t = topRef.current
    const w = screenToWorldTop(t, px.x, px.y)
    const mpp = t.mpp * Math.exp(e.deltaY * 0.0015)
    setTop({ ...t, mpp, center: { e: w.e - (px.x - t.width / 2) * mpp, n: w.n + (px.y - t.height / 2) * mpp } })
  }

  const S = (q: XY) => worldToScreenTop(top, q)
  const isTop = p.viewMode === 'top'
  const sec = shownSection
  const rubber = p.mode === 'draw' && pendingA && hover && !sec ? { a: pendingA, b: hover } : null

  return (
    <div ref={wrapRef} className="terrain-view" data-testid="terrain-view">
      <canvas ref={canvasRef} className="terrain-canvas" style={{ visibility: webglOk ? 'visible' : 'hidden' }} />
      <div ref={labelRef} className="label-layer" style={{ display: isTop ? 'none' : 'block' }} />
      {isTop && (
        <svg
          className={`top-overlay mode-${p.mode}`}
          data-testid="topview-overlay"
          width={size.w}
          height={size.h}
          data-mpp={top.mpp}
          data-center-e={top.center.e}
          data-center-n={top.center.n}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHover(null)}
          onWheel={onWheel}
        >
          {p.bounds && !webglOk && (
            <rect
              x={S({ e: p.bounds.min.e, n: p.bounds.max.n }).x}
              y={S({ e: p.bounds.min.e, n: p.bounds.max.n }).y}
              width={(p.bounds.max.e - p.bounds.min.e) / top.mpp}
              height={(p.bounds.max.n - p.bounds.min.n) / top.mpp}
              fill="#e8efe5"
              stroke="#6b8f5e"
            />
          )}
          {p.holes.map((h) => {
            const c = S(h.collar), t = S(boreholeToe(h)), sel = h.id === p.selectedId
            return (
              <g key={h.id} className="plan-obj">
                <line x1={c.x} y1={c.y} x2={t.x} y2={t.y} stroke={sel ? '#d1242f' : '#6e40c9'} strokeWidth={2} />
                <rect x={c.x - 4} y={c.y - 4} width={8} height={8} fill={sel ? '#d1242f' : '#6e40c9'} />
                <text x={c.x + 6} y={c.y - 6} fontSize={11}>{h.name}</text>
              </g>
            )
          })}
          {p.points.map((q) => {
            const c = S(q), sel = q.id === p.selectedId
            return (
              <g key={q.id} className="plan-obj">
                <circle cx={c.x} cy={c.y} r={4} fill={sel ? '#d1242f' : '#1f6feb'} />
                <text x={c.x + 6} y={c.y - 6} fontSize={11}>{q.name}</text>
              </g>
            )
          })}
          {(sec ?? rubber) && (() => {
            const s = (sec ?? rubber)!
            const a = S(s.a), b = S(s.b)
            return (
              <g data-testid="ab-line">
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d1242f" strokeWidth={2.5} strokeDasharray={draft || rubber ? '6 4' : undefined} />
                <circle data-testid="handle-a" cx={a.x} cy={a.y} r={p.mode === 'edit' ? 7 : 5} fill="#0b7a3e" stroke="#fff" strokeWidth={2} />
                <circle data-testid="handle-b" cx={b.x} cy={b.y} r={p.mode === 'edit' ? 7 : 5} fill="#b35900" stroke="#fff" strokeWidth={2} />
                <text x={a.x - 14} y={a.y - 8} fontWeight="bold" fill="#0b7a3e">A</text>
                <text x={b.x + 8} y={b.y - 8} fontWeight="bold" fill="#b35900">B</text>
              </g>
            )
          })()}
          {pendingA && !sec && (
            <circle data-testid="pending-a" cx={S(pendingA).x} cy={S(pendingA).y} r={5} fill="#0b7a3e" />
          )}
        </svg>
      )}
      <div className="north-arrow" title="Utara grid" style={{ transform: `rotate(${northAngle}deg)` }} data-testid="north-arrow">
        <svg width="28" height="40" viewBox="0 0 28 40">
          <path d="M14 2 L22 26 L14 21 L6 26 Z" fill="#1d232a" />
          <text x="14" y="38" textAnchor="middle" fontSize="11" fontWeight="bold">U</text>
        </svg>
      </div>
      {hover && isTop && (
        <div className="cursor-readout" data-testid="cursor-readout">
          E {hover.e.toFixed(2)} · N {hover.n.toFixed(2)}
        </div>
      )}
    </div>
  )
}
