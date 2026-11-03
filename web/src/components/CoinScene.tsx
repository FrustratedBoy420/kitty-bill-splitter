import { useEffect, useRef } from 'react'
import {
  AmbientLight,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  WebGLRenderer,
} from 'three'

// The Kitty mark in 3D: one coin cut into four shares, the first one paid (cobalt), the others in
// the flatmate tints. It sways (never turns edge-on), leans toward the pointer, and the shares part
// on hover.
// Loaded lazily from HomePicker, so the bill screens never download three.js.

const SHARES = [
  { color: '#1d5fd6', angle: Math.PI * 0.62 }, // paid, a little larger: it got the extra cent
  { color: '#dcebff', angle: Math.PI * 0.46 },
  { color: '#fdebd0', angle: Math.PI * 0.46 },
  { color: '#d4f1ec', angle: Math.PI * 0.46 },
]
const RADIUS = 1
const GAP = 0.035 // how far each share sits out from the centre at rest
const SPREAD = 0.16 // extra distance on hover

function wedge(start: number, length: number): ExtrudeGeometry {
  const shape = new Shape()
  shape.moveTo(0, 0)
  shape.absarc(0, 0, RADIUS, start, start + length, false)
  shape.lineTo(0, 0)
  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.2,
    curveSegments: 48,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 4,
  })
  geometry.translate(0, 0, -0.1)
  return geometry
}

export default function CoinScene({ label }: { label: string }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return // No WebGL: the static SVG fallback stays in place.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    el.appendChild(renderer.domElement)
    el.dataset.ready = 'true'

    const scene = new Scene()
    const camera = new PerspectiveCamera(32, 1, 0.1, 50)
    camera.position.set(0, 0, 5)

    scene.add(new AmbientLight('#ffffff', 1.6))
    const key = new DirectionalLight('#ffffff', 2.2)
    key.position.set(2.5, 3, 4)
    scene.add(key)
    const rim = new DirectionalLight('#dcf1ff', 1.2)
    rim.position.set(-3, -1, -2)
    scene.add(rim)

    const coin = new Group()
    const pieces: { mesh: Mesh; dx: number; dy: number }[] = []
    let start = Math.PI / 2
    for (const share of SHARES) {
      const mesh = new Mesh(
        wedge(start, share.angle),
        new MeshStandardMaterial({ color: share.color, roughness: 0.42, metalness: 0.08 }),
      )
      const mid = start + share.angle / 2
      pieces.push({ mesh, dx: Math.cos(mid), dy: Math.sin(mid) })
      coin.add(mesh)
      start += share.angle
    }
    coin.rotation.set(-0.35, 0.35, 0)
    scene.add(coin)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pointer = { x: 0, y: 0 }
    let hover = 0
    let hoverTarget = 0
    let visible = true
    let frame = 0
    let last = performance.now()
    let t = 0

    function resize() {
      const { width, height } = el?.getBoundingClientRect() ?? { width: 1, height: 1 }
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(height, 1)
      camera.updateProjectionMatrix()
    }

    function draw(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      t += dt
      hover += (hoverTarget - hover) * Math.min(dt * 6, 1)
      for (const p of pieces) {
        const out = GAP + SPREAD * hover
        p.mesh.position.set(p.dx * out, p.dy * out, 0)
      }
      coin.rotation.y = 0.35 + Math.sin(t * 0.6) * 0.45 + pointer.x * 0.3
      coin.rotation.x += (-0.35 + pointer.y * 0.25 - coin.rotation.x) * Math.min(dt * 3, 1)
      coin.rotation.z += (pointer.x * -0.15 - coin.rotation.z) * Math.min(dt * 3, 1)
      renderer.render(scene, camera)
      if (visible) frame = requestAnimationFrame(draw)
    }

    function onMove(event: PointerEvent) {
      const r = el?.getBoundingClientRect()
      if (!r) return
      pointer.x = ((event.clientX - r.left) / r.width) * 2 - 1
      pointer.y = ((event.clientY - r.top) / r.height) * 2 - 1
    }
    const onEnter = () => {
      hoverTarget = 1
    }
    const onLeave = () => {
      hoverTarget = 0
      pointer.x = 0
      pointer.y = 0
    }

    const resizeObserver = new ResizeObserver(() => {
      resize()
      if (reduced) renderer.render(scene, camera)
    })
    resizeObserver.observe(el)
    resize()

    // Only spend frames while the coin is on screen.
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      if (visible && !reduced) {
        cancelAnimationFrame(frame)
        last = performance.now()
        frame = requestAnimationFrame(draw)
      }
    })
    visibility.observe(el)

    if (reduced) {
      for (const p of pieces) p.mesh.position.set(p.dx * GAP, p.dy * GAP, 0)
      renderer.render(scene, camera)
    } else {
      el.addEventListener('pointermove', onMove)
      el.addEventListener('pointerenter', onEnter)
      el.addEventListener('pointerleave', onLeave)
    }

    return () => {
      cancelAnimationFrame(frame)
      visible = false
      resizeObserver.disconnect()
      visibility.disconnect()
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerenter', onEnter)
      el.removeEventListener('pointerleave', onLeave)
      for (const p of pieces) {
        p.mesh.geometry.dispose()
        ;(p.mesh.material as Material).dispose()
      }
      renderer.dispose()
      renderer.domElement.remove()
      delete el.dataset.ready
    }
  }, [])

  return <div ref={host} className="coin-canvas" role="img" aria-label={label} />
}
