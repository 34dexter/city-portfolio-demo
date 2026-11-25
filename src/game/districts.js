import * as THREE from 'three'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { mat, FONT_DISPLAY, FONT_BODY, roundRect, lerp } from './utils.js'
import { FACE_CAMERA_Y } from './layout.js'
import { profile, skills, experience, education } from '../data/resume.js'

const canvasTexture = (width, height, draw) =>
{
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    draw(canvas.getContext('2d'), width, height)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
}

const glowMaterial = (color) => new THREE.MeshBasicMaterial({ color })

/* -------------------------------------------------------------------------- */
/* Landing                                                                     */
/* -------------------------------------------------------------------------- */
export function buildLanding(b, game)
{
    b.floor('#f4e7d0')

    // Decorative rings on the plaza
    const rings = [ [ 12, '#ecd9b8' ], [ 8, '#f4e7d0' ], [ 7.6, '#ffd8a8' ] ]
    rings.forEach(([ radius, color ], i) =>
    {
        const ring = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), mat(color, { flatShading: false }))
        ring.rotation.x = -Math.PI / 2
        ring.position.set(0, 0.036 + i * 0.004, -6)
        b.static(ring)
    })

    // Big 3D name, every letter can be knocked over
    const colors = [ '#ff5a4e', '#ffb02e', '#ffd23f', '#3fc58a', '#4fb3ff', '#8f7bff', '#ff7ab8' ]
    const text = profile.name.toUpperCase()
    const letterSize = 3.2
    const letters = []
    let cursor = 0
    const spacing = 0.45
    for(const char of text)
    {
        if(char === ' ')
        {
            cursor += letterSize * 0.55
            continue
        }
        const geometry = new TextGeometry(char, {
            font: game.font,
            size: letterSize,
            depth: 1.1,
            curveSegments: 5,
            bevelEnabled: true,
            bevelThickness: 0.08,
            bevelSize: 0.06,
            bevelSegments: 2
        })
        geometry.computeBoundingBox()
        const box = geometry.boundingBox
        const width = box.max.x - box.min.x
        const height = box.max.y - box.min.y
        const depth = box.max.z - box.min.z
        geometry.translate(-(box.min.x + width / 2), -(box.min.y + height / 2), -(box.min.z + depth / 2))
        letters.push({ geometry, width, height, depth, x: cursor + width / 2 })
        cursor += width + spacing
    }
    const totalWidth = cursor - spacing
    letters.forEach((letter, i) =>
    {
        const mesh = new THREE.Mesh(letter.geometry, mat(colors[i % colors.length]))
        b.pushable(
            mesh,
            letter.x - totalWidth / 2, letter.height / 2 + 0.02, -8,
            [ { shape: 'box', size: [ letter.width / 2, letter.height / 2, letter.depth / 2 ] } ],
            { mass: 1.2, friction: 0.6, restitution: 0.1 }
        )
    })

    b.groundText([ profile.title ], 0, -3.2, 22, { color: '#5a4a6a', height: 1.6 })

    // About kiosk
    b.box(0.3, 2.2, 0.3, '#3b3a4d', -8.2, 1.1, 4)
    b.sign([ 'Hi! 👋', 'Bangalore, India' ], 3.6, 2, -8.2, 3.2, 4, { background: '#ffd23f', color: '#1d1b2f', posts: false })

    // Controls painted on the floor
    b.groundText([ 'Drive: WASD / arrows', 'SHIFT boost · SPACE jump · ENTER open · C camera · R reset' ], 3, 15.5, 18, { color: '#5a4a6a', height: 3 })

    // Ramp for the brave
    const angle = 0.22
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 7), mat('#ff9f43'))
    ramp.position.set(13, Math.sin(angle) * 3.5 - 0.05, 2)
    ramp.rotation.x = angle
    b.static(ramp)
    const rampQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, FACE_CAMERA_Y, 0, 'YXZ'))
    game.physics.addFixedBox(b.world(13, Math.sin(angle) * 3.5 - 0.05, 2), { x: 2.25, y: 0.2, z: 3.5 }, 0, { quaternion: rampQuat })
    for(let i = 0; i < 5; i++)
    {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.52, 0.42, 0.4), mat('#ffffff'))
        stripe.position.set(13, Math.sin(angle) * 3.5 - 0.05 + Math.sin(angle) * (2.8 - i * 1.4) * -1, 2 + Math.cos(angle) * (2.8 - i * 1.4))
        stripe.rotation.x = angle
        b.static(stripe)
    }

    // Trees and benches around the plaza
    for(const [ x, z ] of [ [ -16, -2 ], [ 16, -6 ], [ -12, -14 ], [ 12, -14 ], [ -17, 6 ] ])
        b.tree(x, z, 1.1, '#ff9ec7')

    return {
        key: 'about',
        title: 'About me',
        sub: profile.name,
        point: new THREE.Vector3(-8.2, 0, 7),
        spawn: new THREE.Vector3(3, 2, 10),
    }
}

/* -------------------------------------------------------------------------- */
/* Skills                                                                      */
/* -------------------------------------------------------------------------- */
export function buildSkills(b, game)
{
    b.floor('#ece6f7')
    b.groundText('SKILLS', 0, 14, 12, { color: '#6b5a8f', height: 3 })

    const size = 1.5
    const crateGeometry = new THREE.BoxGeometry(size, size, size)
    // Programming (the biggest stack) sits right in front of the spawn point
    const clusterX = [ -1, -10.5, 6.5, 13 ]
    const clusterZ = [ -8, -7, -8, -7 ]

    skills.forEach((group, gi) =>
    {
        const cx = clusterX[gi]
        const cz = clusterZ[gi]

        b.sign([ group.category ], 5, 1.3, cx, 4.6, cz - 3.2, { background: group.color, color: '#ffffff' })

        // Stack crates in a pyramid
        const rows = []
        let remaining = group.items.length
        let rowSize = remaining <= 3 ? 2 : remaining <= 5 ? 3 : 4
        while(remaining > 0)
        {
            const n = Math.min(rowSize, remaining)
            rows.push(n)
            remaining -= n
            rowSize = Math.max(1, n - 1)
        }

        let index = 0
        rows.forEach((count, row) =>
        {
            for(let i = 0; i < count; i++)
            {
                const name = group.items[index++]
                const texture = canvasTexture(256, 256, (ctx, w, h) =>
                {
                    ctx.fillStyle = group.color
                    ctx.fillRect(0, 0, w, h)
                    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
                    ctx.lineWidth = 14
                    ctx.strokeRect(12, 12, w - 24, h - 24)
                    ctx.fillStyle = '#ffffff'
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    let fontSize = 64
                    ctx.font = `700 ${fontSize}px ${FONT_DISPLAY}`
                    while(ctx.measureText(name).width > w * 0.82 && fontSize > 20)
                    {
                        fontSize -= 2
                        ctx.font = `700 ${fontSize}px ${FONT_DISPLAY}`
                    }
                    ctx.fillText(name, w / 2, h / 2 + 4)
                })
                const side = new THREE.MeshLambertMaterial({ map: texture })
                const top = mat(group.color)
                const mesh = new THREE.Mesh(crateGeometry, [ side, side, top, top, side, side ])
                const x = cx + (i - (count - 1) / 2) * (size + 0.08)
                const y = size / 2 + row * size + 0.01
                b.pushable(mesh, x, y, cz, [ { shape: 'box', size: [ size / 2, size / 2, size / 2 ] } ], { mass: 0.35, friction: 0.5 })
            }
        })
    })

    for(const [ x, z ] of [ [ -18, 2 ], [ 18, 2 ], [ 0, -18 ] ])
        b.tree(x, z, 1.2)

    return { key: 'skills', title: 'Skills', sub: 'Crates you can knock over', point: new THREE.Vector3(0, 0, 6), spawn: new THREE.Vector3(0, 2, 7) }
}

/* -------------------------------------------------------------------------- */
/* Internship: Take It Smart                                                   */
/* -------------------------------------------------------------------------- */
export function buildInternship(b, game)
{
    b.floor('#e3f1f4')
    const job = experience.internship

    // Office tower
    const towerX = -8
    const towerZ = -8
    const towerH = 20
    b.box(9, towerH, 9, '#9ed8f0', towerX, towerH / 2, towerZ)
    for(let y = 3; y < towerH; y += 3)
        b.box(9.3, 0.35, 9.3, '#ffffff', towerX, y, towerZ, { collider: false })
    b.box(9.6, 0.6, 9.6, '#3b3a4d', towerX, towerH + 0.3, towerZ, { collider: false })
    b.box(4, 1.2, 4, '#e7e3ee', towerX, towerH + 1.2, towerZ, { collider: false })
    b.box(3, 2.8, 0.3, '#5d6f8f', towerX, 1.4, towerZ + 4.55, { collider: false }) // door
    b.sign([ 'Take It Smart' ], 8, 1.6, towerX, towerH - 2, towerZ + 4.7, { background: '#1d1b2f', color: '#7fe3ff', posts: false })

    // Beating heart (cardiac arrhythmia prediction)
    const shape = new THREE.Shape()
    shape.moveTo(5, 5)
    shape.bezierCurveTo(5, 5, 4, 0, 0, 0)
    shape.bezierCurveTo(-6, 0, -6, 7, -6, 7)
    shape.bezierCurveTo(-6, 11, -3, 15.4, 5, 19)
    shape.bezierCurveTo(12, 15.4, 16, 11, 16, 7)
    shape.bezierCurveTo(16, 7, 16, 0, 10, 0)
    shape.bezierCurveTo(7, 0, 5, 5, 5, 5)
    const heartGeometry = new THREE.ExtrudeGeometry(shape, { depth: 4, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1, bevelSegments: 3, curveSegments: 10 })
    heartGeometry.center()
    heartGeometry.rotateZ(Math.PI)
    heartGeometry.scale(0.15, 0.15, 0.15)
    const heart = new THREE.Mesh(heartGeometry, new THREE.MeshLambertMaterial({ color: '#ff3b5c', emissive: '#ff0a3a', emissiveIntensity: 0.15 }))
    heart.position.set(5, 4.4, -6)
    b.dynamicMesh(heart)
    b.cylinder(1.6, 2, 2, '#ffffff', 5, 1, -6)

    // ECG trace on the ground
    const ecg = canvasTexture(1024, 256, (ctx, w, h) =>
    {
        ctx.strokeStyle = '#ff3b5c'
        ctx.lineWidth = 10
        ctx.lineJoin = 'round'
        ctx.beginPath()
        const base = h * 0.6
        ctx.moveTo(0, base)
        for(let beat = 0; beat < 3; beat++)
        {
            const x0 = beat * w / 3
            const s = w / 3 / 100
            ctx.lineTo(x0 + 20 * s, base)
            ctx.lineTo(x0 + 28 * s, base - 18)
            ctx.lineTo(x0 + 34 * s, base)
            ctx.lineTo(x0 + 42 * s, base)
            ctx.lineTo(x0 + 46 * s, base + 30)
            ctx.lineTo(x0 + 52 * s, base - 150)
            ctx.lineTo(x0 + 58 * s, base + 50)
            ctx.lineTo(x0 + 64 * s, base)
            ctx.lineTo(x0 + 76 * s, base)
            ctx.lineTo(x0 + 84 * s, base - 30)
            ctx.lineTo(x0 + 92 * s, base)
            ctx.lineTo(x0 + 100 * s, base)
        }
        ctx.stroke()
    })
    const ecgPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 4).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ map: ecg, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
    )
    ecgPlane.position.set(3, 0.06, -1)
    b.root.add(ecgPlane)

    // Random forest
    const forestColors = [ '#4caf50', '#66bb6a', '#2e7d32', '#81c784' ]
    const forest = [ [ 12, -8 ], [ 14.5, -5 ], [ 10.5, -4.5 ], [ 13, -1.5 ], [ 16, -9 ], [ 9, -10 ] ]
    forest.forEach(([ x, z ], i) => b.tree(x, z, 0.9 + (i % 3) * 0.15, forestColors[i % forestColors.length]))
    b.sign([ 'Random Forest', 'classifier' ], 4.4, 1.6, 12.5, 2.4, 1.6, { background: '#2e7d32', color: '#ffffff' })

    b.groundText([ job.role ], 0, 14, 16, { color: '#2b5f73', height: 2 })

    return {
        key: 'internship',
        title: 'Internship',
        sub: job.company,
        point: new THREE.Vector3(0, 0, 6),
        spawn: new THREE.Vector3(0, 2, 7),
        update: (elapsed) =>
        {
            // Lub-dub heartbeat
            const t = (elapsed * 1.1) % 1
            const pulse = Math.exp(-Math.pow((t - 0.1) * 18, 2)) * 0.18 + Math.exp(-Math.pow((t - 0.3) * 18, 2)) * 0.1
            heart.scale.setScalar(1 + pulse)
            heart.rotation.y = Math.sin(elapsed * 0.6) * 0.35
            heart.material.emissiveIntensity = 0.15 + pulse * 3
        }
    }
}

/* -------------------------------------------------------------------------- */
/* HUDL stadium                                                                */
/* -------------------------------------------------------------------------- */
export function buildHudl(b, game)
{
    b.floor('#dfe8d6')
    const job = experience.hudl
    const pitchW = 22
    const pitchD = 14
    const pitchZ = -3

    const pitchTexture = canvasTexture(1200, 700, (ctx, w, h) =>
    {
        for(let i = 0; i < 12; i++)
        {
            ctx.fillStyle = i % 2 ? '#5fbf4f' : '#55b347'
            ctx.fillRect(i * w / 12, 0, w / 12, h)
        }
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 10
        const m = 30
        ctx.strokeRect(m, m, w - m * 2, h - m * 2)
        ctx.beginPath()
        ctx.moveTo(w / 2, m)
        ctx.lineTo(w / 2, h - m)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(w / 2, h / 2, 90, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeRect(m, h / 2 - 160, 150, 320)
        ctx.strokeRect(w - m - 150, h / 2 - 160, 150, 320)
    })
    const pitch = new THREE.Mesh(new THREE.PlaneGeometry(pitchW, pitchD).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: pitchTexture }))
    pitch.position.set(0, 0.05, pitchZ)
    pitch.receiveShadow = true
    b.root.add(pitch)

    // Goals
    const goalZoneHalf = 2.3
    for(const side of [ -1, 1 ])
    {
        const gx = side * (pitchW / 2 - 0.4)
        for(const pz of [ -goalZoneHalf, goalZoneHalf ])
            b.box(0.2, 2.2, 0.2, '#ffffff', gx, 1.1, pitchZ + pz)
        b.box(0.2, 0.2, goalZoneHalf * 2 + 0.2, '#ffffff', gx, 2.2, pitchZ, { collider: false })
        // Nets: see-through, but still solid for the ball
        const net = mat('#ffffff', { transparent: true, opacity: 0.45, depthWrite: false })
        b.box(0.1, 2.2, goalZoneHalf * 2, null, gx + side * 1.4, 1.1, pitchZ, { material: net })
        for(const pz of [ -goalZoneHalf, goalZoneHalf ])
            b.box(1.4, 2.2, 0.05, null, gx + side * 0.7, 1.1, pitchZ + pz, { material: net })
    }

    // Stands in HUDL orange
    for(let step = 0; step < 3; step++)
    {
        const h = 0.8 * (step + 1)
        b.box(pitchW, h, 1.6, step % 2 ? '#ff6a13' : '#ff8a3d', 0, h / 2, pitchZ - pitchD / 2 - 1.6 - step * 1.6)
    }

    // Big screen with stats
    const screenTexture = canvasTexture(960, 400, (ctx, w, h) =>
    {
        ctx.fillStyle = '#16151f'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#ff6a13'
        ctx.font = `700 120px ${FONT_DISPLAY}`
        ctx.textBaseline = 'top'
        ctx.fillText('HUDL', 40, 40)
        ctx.fillStyle = '#ffffff'
        ctx.font = `600 40px ${FONT_BODY}`
        ctx.fillText(job.role, 40, 180)
        ctx.fillStyle = 'rgba(255,255,255,0.7)'
        ctx.font = `600 32px ${FONT_BODY}`
        ctx.fillText('Nov 2024 – Mar 2025', 40, 236)
        const bars = [ 0.4, 0.65, 0.5, 0.85, 0.7, 0.95 ]
        bars.forEach((value, i) =>
        {
            ctx.fillStyle = i % 2 ? '#ff6a13' : '#4fb3ff'
            const bh = value * 260
            ctx.fillRect(560 + i * 62, 340 - bh, 44, bh)
        })
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.fillRect(550, 342, 380, 4)
    })
    const screenMaterial = new THREE.MeshBasicMaterial({ map: screenTexture })
    const screen = new THREE.Mesh(new THREE.BoxGeometry(9.6, 4, 0.3), [ mat('#2a2838'), mat('#2a2838'), mat('#2a2838'), mat('#2a2838'), screenMaterial, mat('#2a2838') ])
    screen.position.set(0, 6.6, pitchZ - pitchD / 2 - 5.2)
    screen.castShadow = true
    b.root.add(screen)
    b.box(0.4, 4.6, 0.4, '#2a2838', -3, 2.3, pitchZ - pitchD / 2 - 5.4)
    b.box(0.4, 4.6, 0.4, '#2a2838', 3, 2.3, pitchZ - pitchD / 2 - 5.4)

    // Floodlights
    const floodMaterial = new THREE.MeshBasicMaterial({ color: '#fffbe6' })
    for(const side of [ -1, 1 ])
    {
        const x = side * 13
        const z = pitchZ - pitchD / 2 - 1
        b.cylinder(0.18, 0.25, 9, '#3b3a4d', x, 4.5, z)
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 0.4), floodMaterial)
        panel.position.set(x, 9.2, z)
        panel.rotation.x = 0.5
        b.root.add(panel)
    }

    // Ball
    const ballGeometry = new THREE.IcosahedronGeometry(0.75, 1)
    const colors = new Float32Array(ballGeometry.attributes.position.count * 3)
    for(let face = 0; face < colors.length / 9; face++)
    {
        const dark = face % 5 === 0 ? 0.12 : 0.97
        for(let v = 0; v < 9; v++) colors[face * 9 + v] = dark
    }
    ballGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const ball = new THREE.Mesh(ballGeometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }))
    const ballItem = b.pushable(ball, 0, 0.8, pitchZ, [ { shape: 'ball', size: [ 0.75 ] } ], { mass: 0.12, restitution: 0.65, friction: 0.5, linearDamping: 0.35, angularDamping: 0.4 })

    b.groundText([ 'HUDL India' ], 0, 14, 12, { color: '#c4510b', height: 2.6 })

    let goalCooldown = 0
    const local = new THREE.Vector3()
    return {
        key: 'hudl',
        title: 'Sports Data Analyst',
        sub: 'HUDL India',
        point: new THREE.Vector3(0, 0, 7),
        spawn: new THREE.Vector3(0, 2, 7),
        update: (elapsed, delta) =>
        {
            goalCooldown -= delta
            local.copy(ball.position)
            b.root.worldToLocal(local)
            const inGoal = Math.abs(local.x) > pitchW / 2 - 0.4 && Math.abs(local.z - pitchZ) < goalZoneHalf && local.y < 2.2
            if(inGoal && goalCooldown <= 0)
            {
                goalCooldown = 3
                game.events.emit('goal')
                setTimeout(() => game.physics.resetItem(ballItem), 1800)
            }
        }
    }
}

/* -------------------------------------------------------------------------- */
/* Education                                                                   */
/* -------------------------------------------------------------------------- */
export function buildEducation(b, game)
{
    b.floor('#f3ecdc')
    const z = -10

    // Main hall
    b.box(20, 7, 8, '#f7f1e3', 0, 3.5, z)
    b.box(20.6, 0.6, 8.6, '#c9b99a', 0, 7.3, z, { collider: false })
    // Steps
    for(let i = 0; i < 3; i++)
        b.box(12 - i * 1.2, 0.25, 1, '#e2d6bf', 0, 0.125 + i * 0.25, z + 5.6 - i * 0.9, { collider: false })
    // Columns
    for(let i = 0; i < 6; i++)
        b.cylinder(0.4, 0.45, 6, '#ffffff', -6.25 + i * 2.5, 3.6, z + 4.8)
    b.box(16, 0.6, 2, '#efe6d2', 0, 6.9, z + 4.8, { collider: false })
    // Pediment
    const triangle = new THREE.Shape()
    triangle.moveTo(-8.5, 0)
    triangle.lineTo(8.5, 0)
    triangle.lineTo(0, 3)
    triangle.closePath()
    const pediment = new THREE.Mesh(new THREE.ExtrudeGeometry(triangle, { depth: 2, bevelEnabled: false }), mat('#f7f1e3'))
    pediment.position.set(0, 7.2, z + 3.8)
    b.static(pediment)
    // Windows
    for(let i = 0; i < 4; i++)
    {
        b.box(1.4, 2.2, 0.1, '#7aa7d8', -8.6 + i * 1.6 + (i > 1 ? 13 : 0), 3.6, z + 4.02, { collider: false })
    }

    b.sign([ education.school ], 11, 1, 0, 8.05, z + 5.9, { background: '#7a2e3b', color: '#fff6e0', posts: false, depth: 0.1 })
    b.sign([ 'BE · ECE', education.year ], 4.6, 2.4, -11, 2.6, 2, { background: '#7a2e3b', color: '#fff6e0', sizes: [ 70, 60 ] })

    // Floating graduation cap
    const cap = new THREE.Group()
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 3.4), mat('#1d1b2f'))
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1, 16), mat('#1d1b2f'))
    base.position.y = -0.55
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.15, 8), mat('#ffd23f'))
    button.position.y = 0.17
    const tassel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), mat('#ffd23f'))
    tassel.position.set(1.6, -0.6, 1.6)
    const string = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 0.06), mat('#ffd23f'))
    string.position.set(0.8, 0.14, 0.8)
    string.rotation.y = -Math.PI / 4
    cap.add(board, base, button, tassel, string)
    cap.traverse((child) => { child.castShadow = true })
    cap.position.set(0, 13.5, z)
    b.root.add(cap)

    b.tree(-14, -1, 1.1)
    b.tree(14, -1, 1.1)
    b.tree(16, -6, 0.9)
    b.groundText([ 'Education' ], 0, 14, 12, { color: '#7a2e3b', height: 2.6 })

    return {
        key: 'education',
        title: 'Education',
        sub: `${education.degree} · ${education.year}`,
        point: new THREE.Vector3(0, 0, 6),
        spawn: new THREE.Vector3(0, 2, 7),
        update: (elapsed) =>
        {
            cap.rotation.y = elapsed * 0.6
            cap.position.y = 13.5 + Math.sin(elapsed * 1.4) * 0.5
        }
    }
}

/* -------------------------------------------------------------------------- */
/* Event planner                                                               */
/* -------------------------------------------------------------------------- */
export function buildEventPlanner(b, game)
{
    b.floor('#fbe4ea')
    const z = -9

    // Stage
    b.box(13, 1, 6, '#3b3a4d', 0, 0.5, z)
    b.box(13.4, 0.15, 6.4, '#ff7ab8', 0, 1.05, z, { collider: false })

    // Backdrop with the project name
    const banner = canvasTexture(1300, 520, (ctx, w, h) =>
    {
        const gradient = ctx.createLinearGradient(0, 0, w, h)
        gradient.addColorStop(0, '#ff7ab8')
        gradient.addColorStop(0.5, '#ffb347')
        gradient.addColorStop(1, '#8f7bff')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `700 190px ${FONT_DISPLAY}`
        ctx.fillText('Eventrra', w / 2, h * 0.42)
        ctx.font = `600 56px ${FONT_BODY}`
        ctx.fillText('Event planner website · HTML · CSS · JS', w / 2, h * 0.78)
    })
    const backdrop = new THREE.Mesh(
        new THREE.BoxGeometry(13, 5.2, 0.3),
        [ mat('#3b3a4d'), mat('#3b3a4d'), mat('#3b3a4d'), mat('#3b3a4d'), new THREE.MeshLambertMaterial({ map: banner, emissive: '#ffffff', emissiveMap: banner, emissiveIntensity: 0.2 }), mat('#3b3a4d') ]
    )
    backdrop.position.set(0, 3.7, z - 2.8)
    backdrop.castShadow = true
    b.root.add(backdrop)
    game.physics.addFixedBox(b.world(0, 3.7, z - 2.8), { x: 6.5, y: 2.6, z: 0.15 }, FACE_CAMERA_Y)

    // Truss arch
    for(const side of [ -1, 1 ])
        b.box(0.5, 8, 0.5, '#6d6b80', side * 7, 4, z + 2.8)
    b.box(14.5, 0.5, 0.5, '#6d6b80', 0, 8, z + 2.8, { collider: false })

    // String lights from the arch to front poles
    const bulbs = []
    const bulbColors = [ '#ffd23f', '#ff7ab8', '#4fb3ff', '#3fc58a', '#ff9f43' ]
    const poles = [ [ -11, 6 ], [ 11, 6 ] ]
    for(const [ px, pz ] of poles)
        b.cylinder(0.12, 0.15, 5, '#6d6b80', px, 2.5, pz)
    const addString = (from, to, sag) =>
    {
        const count = 12
        for(let i = 1; i < count; i++)
        {
            const t = i / count
            const p = new THREE.Vector3().lerpVectors(from, to, t)
            p.y -= Math.sin(t * Math.PI) * sag
            bulbs.push({ position: p, color: bulbColors[bulbs.length % bulbColors.length] })
        }
    }
    addString(new THREE.Vector3(-7, 7.8, z + 2.8), new THREE.Vector3(-11, 5, 6), 1.2)
    addString(new THREE.Vector3(7, 7.8, z + 2.8), new THREE.Vector3(11, 5, 6), 1.2)
    addString(new THREE.Vector3(-7, 7.6, z + 2.8), new THREE.Vector3(7, 7.6, z + 2.8), 1.4)
    const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial(), bulbs.length)
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    bulbs.forEach((bulb, i) =>
    {
        dummy.position.copy(bulb.position)
        dummy.updateMatrix()
        bulbMesh.setMatrixAt(i, dummy.matrix)
        bulbMesh.setColorAt(i, color.set(bulb.color))
    })
    b.root.add(bulbMesh)

    // Balloons
    const balloons = []
    const balloonColors = [ '#ff5a4e', '#ffd23f', '#4fb3ff', '#ff7ab8', '#3fc58a', '#8f7bff' ]
    for(const [ cx, cz ] of [ [ -9, -6 ], [ 9, -6 ] ])
    {
        for(let i = 0; i < 6; i++)
        {
            const group = new THREE.Group()
            const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), new THREE.MeshLambertMaterial({ color: balloonColors[i] }))
            balloon.scale.y = 1.2
            balloon.castShadow = true
            const string = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3, 4), mat('#ffffff'))
            string.position.y = -2.2
            group.add(balloon, string)
            const angle = (i / 6) * Math.PI * 2
            group.position.set(cx + Math.cos(angle) * 0.9, 4.2 + (i % 3) * 0.6, cz + Math.sin(angle) * 0.9)
            group.userData.base = group.position.y
            group.userData.phase = i * 1.3 + cx
            b.root.add(group)
            balloons.push(group)
        }
        b.box(0.8, 0.8, 0.8, '#ffffff', cx, 0.4, cz)
    }

    // Round tables
    for(const [ x, tz ] of [ [ -6, 2 ], [ 6, 2 ] ])
    {
        b.cylinder(1.4, 1.4, 0.15, '#ffffff', x, 1, tz, { collider: false })
        b.cylinder(0.15, 0.15, 1, '#6d6b80', x, 0.5, tz)
        b.cylinder(1.45, 1.45, 0.6, '#ffe1ec', x, 0.7, tz, { collider: false })
    }

    // Gift boxes to push around
    const giftColors = [ '#8f7bff', '#3fc58a', '#ff5a4e' ]
    giftColors.forEach((c, i) =>
    {
        const gift = new THREE.Group()
        const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(c))
        const ribbonA = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 0.2), mat('#ffd23f'))
        const ribbonB = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.02, 1.02), mat('#ffd23f'))
        gift.add(box, ribbonA, ribbonB)
        gift.traverse((child) => { child.castShadow = true })
        b.pushable(gift, -2 + i * 2, 0.52, 3.5, [ { shape: 'box', size: [ 0.5, 0.5, 0.5 ] } ], { mass: 0.2 })
    })

    b.groundText([ 'Event Planner' ], 0, 14, 13, { color: '#b03a78', height: 2.6 })

    return {
        key: 'eventPlanner',
        title: 'Event Planner',
        sub: 'Project · live website',
        point: new THREE.Vector3(0, 0, 8),
        spawn: new THREE.Vector3(0, 2, 8),
        update: (elapsed) =>
        {
            for(const balloon of balloons)
            {
                balloon.position.y = balloon.userData.base + Math.sin(elapsed * 1.2 + balloon.userData.phase) * 0.25
                balloon.rotation.z = Math.sin(elapsed * 0.8 + balloon.userData.phase) * 0.08
            }
        }
    }
}

/* -------------------------------------------------------------------------- */
/* Bone cancer prediction lab                                                  */
/* -------------------------------------------------------------------------- */
export function buildBoneCancer(b, game)
{
    b.floor('#e4eefb')
    const z = -11

    // Lab building
    b.box(12, 7, 7, '#ffffff', -6, 3.5, z)
    b.box(12.2, 0.8, 7.2, '#4fb3ff', -6, 5.6, z, { collider: false })
    b.box(12.4, 0.4, 7.4, '#3b3a4d', -6, 7.2, z, { collider: false })
    b.box(2.6, 3, 0.2, '#7aa7d8', -6, 1.5, z + 3.55, { collider: false })
    for(const x of [ -10, -2 ])
        b.box(2.2, 1.6, 0.1, '#7aa7d8', x, 3, z + 3.55, { collider: false })
    b.sign([ 'Deep Learning Lab' ], 7, 1.1, -6, 6.6, z + 3.75, { background: '#1d1b2f', color: '#7fe3ff', posts: false, depth: 0.1 })

    // Giant microscope
    const mx = -11
    const mz = 0
    b.box(3, 0.5, 2.4, '#3b3a4d', mx, 0.25, mz)
    b.box(0.8, 4, 0.8, '#e7e3ee', mx, 2.5, mz - 0.8)
    b.box(2.4, 0.2, 2, '#3b3a4d', mx, 1.8, mz + 0.2, { collider: false })
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 3, 12), mat('#ffffff'))
    tube.position.set(mx, 3.6, mz + 0.1)
    tube.rotation.x = 0.35
    b.static(tube)
    const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), mat('#3b3a4d'))
    eyepiece.position.set(mx, 5.4, mz - 0.5)
    eyepiece.rotation.x = 0.35
    b.static(eyepiece)
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.6, 10), mat('#4fb3ff'))
    lens.position.set(mx, 2.05, mz + 0.6)
    b.static(lens)

    // Neural network sculpture (VGG16 feature extractor → prediction)
    const layers = [ 3, 5, 5, 2 ]
    const layerX = [ 3, 6, 9, 12 ]
    const nz = -7
    const nodes = []
    const linePositions = []
    layers.forEach((count, li) =>
    {
        for(let i = 0; i < count; i++)
        {
            const y = 3.4 + (i - (count - 1) / 2) * 1.15
            const node = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), new THREE.MeshBasicMaterial({ color: '#4fb3ff' }))
            node.position.set(layerX[li], y, nz)
            node.userData.layer = li
            b.root.add(node)
            nodes.push(node)
        }
    })
    nodes.forEach((a) =>
    {
        nodes.forEach((c) =>
        {
            if(c.userData.layer === a.userData.layer + 1)
                linePositions.push(a.position.x, a.position.y, a.position.z, c.position.x, c.position.y, c.position.z)
        })
    })
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3))
    const lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: '#9fc9ff', transparent: true, opacity: 0.6 }))
    b.root.add(lines)
    b.box(11, 0.3, 1, '#3b3a4d', 7.5, 0.15, nz)
    for(const x of [ 2.2, 12.8 ])
        b.box(0.25, 6.4, 0.25, '#3b3a4d', x, 3.2, nz)
    b.sign([ 'VGG16 · DNN', 'IHC image → prediction' ], 5, 1.8, 7.5, 1.8, nz + 2.4, { background: '#1d1b2f', color: '#ffffff', posts: true })

    // A pushable bone
    const bone = new THREE.Group()
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.6, 10), mat('#fff6ea'))
    shaft.rotation.z = Math.PI / 2
    bone.add(shaft)
    for(const sx of [ -1.4, 1.4 ])
        for(const sz of [ -0.35, 0.35 ])
        {
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 10), mat('#fff6ea'))
            knob.position.set(sx, 0, sz)
            bone.add(knob)
        }
    bone.traverse((child) => { child.castShadow = true })
    b.pushable(bone, 8, 0.6, 3, [
        { shape: 'box', size: [ 1.3, 0.3, 0.3 ] },
        { shape: 'ball', size: [ 0.48 ], offset: { x: -1.4, y: 0, z: -0.35 } },
        { shape: 'ball', size: [ 0.48 ], offset: { x: -1.4, y: 0, z: 0.35 } },
        { shape: 'ball', size: [ 0.48 ], offset: { x: 1.4, y: 0, z: -0.35 } },
        { shape: 'ball', size: [ 0.48 ], offset: { x: 1.4, y: 0, z: 0.35 } },
    ], { mass: 0.3 })

    b.tree(16, 2, 1)
    b.tree(-17, 4, 1.1)
    b.groundText([ 'Bone Cancer Prediction' ], 0, 14, 16, { color: '#2b5f9e', height: 2.2 })

    const pulseColor = new THREE.Color()
    const baseColor = new THREE.Color('#4fb3ff')
    const hotColor = new THREE.Color('#ffffff')
    return {
        key: 'boneCancer',
        title: 'Bone Cancer Prediction',
        sub: 'Final-year project · DNN',
        point: new THREE.Vector3(0, 0, 7),
        spawn: new THREE.Vector3(0, 2, 7),
        update: (elapsed) =>
        {
            // Signal travels from input layer to output layer
            const wave = (elapsed * 1.6) % (layers.length + 1)
            for(const node of nodes)
            {
                const d = Math.abs(wave - node.userData.layer - 0.5)
                const strength = Math.max(0, 1 - d * 1.6)
                pulseColor.lerpColors(baseColor, hotColor, strength)
                node.material.color.copy(pulseColor)
                node.scale.setScalar(1 + strength * 0.35)
            }
        }
    }
}

/* -------------------------------------------------------------------------- */
/* Dual-axis solar tracker                                                     */
/* -------------------------------------------------------------------------- */
export function buildSolarTracker(b, game)
{
    b.floor('#fbf2d5')

    const cells = canvasTexture(512, 340, (ctx, w, h) =>
    {
        ctx.fillStyle = '#c9d6e6'
        ctx.fillRect(0, 0, w, h)
        const cols = 6
        const rows = 4
        const pad = 6
        for(let i = 0; i < cols; i++)
            for(let j = 0; j < rows; j++)
            {
                const cw = (w - pad) / cols
                const ch = (h - pad) / rows
                const gradient = ctx.createLinearGradient(0, j * ch, 0, (j + 1) * ch)
                gradient.addColorStop(0, '#2b4f9e')
                gradient.addColorStop(1, '#1a2f6b')
                ctx.fillStyle = gradient
                ctx.fillRect(pad + i * cw, pad + j * ch, cw - pad, ch - pad)
                ctx.strokeStyle = 'rgba(255,255,255,0.15)'
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.moveTo(pad + i * cw + (cw - pad) / 2, pad + j * ch)
                ctx.lineTo(pad + i * cw + (cw - pad) / 2, pad + (j + 1) * ch - pad)
                ctx.stroke()
            }
    })
    const panelMaterial = new THREE.MeshLambertMaterial({ map: cells })
    const frame = mat('#d8dce6')
    const panelMaterials = [ frame, frame, panelMaterial, frame, frame, frame ]

    // Tracker
    const tz = -6
    b.cylinder(0.9, 1.3, 0.6, '#9a9aae', 0, 0.3, tz)
    b.cylinder(0.35, 0.45, 3.2, '#d8dce6', 0, 1.9, tz)
    const yaw = new THREE.Group()
    yaw.position.set(0, 3.5, tz)
    b.root.add(yaw)
    const servoYaw = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.8), mat('#2f6fe0'))
    yaw.add(servoYaw)
    const fork = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 0.3), mat('#d8dce6'))
    fork.position.y = 0.4
    yaw.add(fork)
    const pitch = new THREE.Group()
    pitch.position.y = 0.7
    yaw.add(pitch)
    const panel = new THREE.Mesh(new THREE.BoxGeometry(7, 0.22, 4.6), panelMaterials)
    panel.castShadow = true
    panel.receiveShadow = true
    pitch.add(panel)
    // LDR sensors and divider on the panel corners
    const ldrMaterial = new THREE.MeshLambertMaterial({ color: '#ff5a4e', emissive: '#ff5a4e', emissiveIntensity: 0.3 })
    for(const [ sx, sz ] of [ [ -1, -1 ], [ 1, -1 ], [ -1, 1 ], [ 1, 1 ] ])
    {
        const ldr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.25, 10), ldrMaterial)
        ldr.position.set(sx * 3.25, 0.22, sz * 2.05)
        pitch.add(ldr)
    }
    const dividerA = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.9), mat('#3b3a4d'))
    dividerA.position.set(0, 0.36, 0)
    const dividerB = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.06), mat('#3b3a4d'))
    dividerB.position.set(0, 0.36, 0)
    pitch.add(dividerA, dividerB)
    yaw.traverse((child) => { child.castShadow = true })

    // Fixed panel for comparison
    const fixed = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.18, 3), panelMaterials)
    fixed.position.set(-11, 1.8, -2)
    fixed.rotation.x = 0.5
    b.static(fixed)
    b.box(0.25, 1.6, 0.25, '#9a9aae', -12.8, 0.8, -1.2)
    b.box(0.25, 1.6, 0.25, '#9a9aae', -9.2, 0.8, -1.2)
    b.box(0.25, 2.4, 0.25, '#9a9aae', -12.8, 1.2, -2.8)
    b.box(0.25, 2.4, 0.25, '#9a9aae', -9.2, 1.2, -2.8)
    b.sign([ 'Fixed panel' ], 3.6, 1, -11, 1.2, 1.4, { background: '#9a9aae', color: '#ffffff' })
    b.sign([ 'Dual-axis tracker', 'follows the sun' ], 4.8, 1.6, 0, 1.6, -1.2, { background: '#ffb02e', color: '#1d1b2f' })

    // Arduino board
    const ax = 10
    const az = -3
    b.box(3.4, 0.3, 2.4, '#0b7ea8', ax, 0.5, az)
    b.box(1.2, 0.25, 0.4, '#1d1b2f', ax, 0.75, az + 0.2, { collider: false })
    b.box(0.6, 0.35, 0.6, '#c0c4cc', ax - 1.5, 0.8, az - 0.7, { collider: false })
    b.box(2.4, 0.2, 0.2, '#1d1b2f', ax + 0.2, 0.75, az - 1, { collider: false })
    b.box(2.4, 0.2, 0.2, '#1d1b2f', ax + 0.2, 0.75, az + 1, { collider: false })
    b.box(0.3, 0.35, 0.3, '#c0c4cc', ax + 1.4, 0.8, az + 0.4, { collider: false })
    b.sign([ 'Arduino' ], 3, 0.9, ax, 1.6, az + 2.2, { background: '#0b7ea8', color: '#ffffff' })

    // Wires from Arduino to the tracker
    for(const [ color, offset ] of [ [ '#ff5a4e', 0 ], [ '#1d1b2f', 0.25 ] ])
    {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(ax - 1.7, 0.6, az + offset),
            new THREE.Vector3(ax - 4, 0.1, az + offset - 0.5),
            new THREE.Vector3(3, 0.1, tz + 1 + offset),
            new THREE.Vector3(0.9, 0.4, tz + offset),
        ])
        const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.07, 6), mat(color))
        b.static(wire)
    }

    b.tree(16, -2, 1)
    b.tree(-16, 6, 1)
    b.groundText([ 'Solar Tracker' ], 0, 14, 12, { color: '#b07800', height: 2.6 })

    const localSun = new THREE.Vector3()
    const inverse = new THREE.Quaternion()
    let yawAngle = 0
    let pitchAngle = 0
    return {
        key: 'solarTracker',
        title: 'Solar Tracker',
        sub: 'Mini project · Arduino',
        point: new THREE.Vector3(0, 0, 7),
        spawn: new THREE.Vector3(0, 2, 7),
        update: (elapsed, delta, env) =>
        {
            // Face the sun during the day, park flat at night
            inverse.copy(b.root.quaternion).invert()
            localSun.copy(env.sunDirection).applyQuaternion(inverse)
            const night = env.current.night
            const targetYaw = Math.atan2(localSun.x, localSun.z)
            const targetPitch = Math.acos(THREE.MathUtils.clamp(localSun.y, -1, 1)) * (1 - night)

            let diff = targetYaw - yawAngle
            diff = Math.atan2(Math.sin(diff), Math.cos(diff))
            yawAngle += diff * Math.min(1, delta * 1.5)
            pitchAngle = lerp(pitchAngle, targetPitch, Math.min(1, delta * 1.5))
            yaw.rotation.y = yawAngle
            pitch.rotation.x = pitchAngle
            ldrMaterial.emissiveIntensity = 0.3 + Math.sin(elapsed * 4) * 0.2
        }
    }
}

/* -------------------------------------------------------------------------- */
/* Contact                                                                     */
/* -------------------------------------------------------------------------- */
export function buildContact(b, game, links)
{
    b.floor('#fde7dc')
    const z = -10

    // Post office
    b.box(11, 6, 7, '#fff3df', -6, 3, z)
    b.box(11.2, 0.9, 7.2, '#d8352f', -6, 5.4, z, { collider: false })
    b.box(11.6, 0.4, 7.6, '#3b3a4d', -6, 6.2, z, { collider: false })
    b.box(2.4, 3, 0.2, '#8a5a3b', -6, 1.5, z + 3.55, { collider: false })
    b.sign([ 'Say hello!' ], 6, 1.1, -6, 4.3, z + 3.7, { background: '#d8352f', color: '#ffffff', posts: false, depth: 0.1 })

    // Red pillar post box
    const px = 3
    const pz = -5
    b.cylinder(0.95, 0.95, 2.6, '#d8352f', px, 1.3, pz)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d8352f'))
    dome.position.set(px, 2.6, pz)
    b.static(dome)
    b.cylinder(1.1, 1.1, 0.2, '#b22a25', px, 2.62, pz, { collider: false })
    b.box(1, 0.16, 0.2, '#1d1b2f', px, 2.15, pz + 0.92, { collider: false })
    b.cylinder(1.1, 1.2, 0.3, '#3b3a4d', px, 0.15, pz, { collider: false })
    const plate = b.sign([ 'POST' ], 1, 0.5, px, 1.5, pz + 0.98, { background: '#ffffff', color: '#d8352f', posts: false, depth: 0.04 })
    plate.castShadow = false

    // Signpost with contact links
    const sx = 10
    const sz = -3
    b.cylinder(0.15, 0.18, 6, '#8a5a3b', sx, 3, sz)
    links.slice(0, 4).forEach((link, i) =>
    {
        const right = i % 2 === 0
        const board = b.sign([ link.label ], 3.2, 0.8, sx + (right ? 1.7 : -1.7), 5.2 - i * 1, sz, { background: [ '#4fb3ff', '#3fc58a', '#ffb02e', '#8f7bff' ][i], color: '#ffffff', posts: false, depth: 0.15 })
        board.rotation.y = right ? -0.25 : 0.25
    })

    b.tree(16, 2, 1, '#ff9ec7')
    b.tree(-16, 2, 1, '#ff9ec7')
    b.groundText([ "Let's talk!" ], 0, 14, 12, { color: '#b0322d', height: 2.6 })

    return { key: 'contact', title: 'Contact', sub: profile.email, point: new THREE.Vector3(0, 0, 6), spawn: new THREE.Vector3(0, 2, 7) }
}
