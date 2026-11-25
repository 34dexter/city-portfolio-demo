import * as THREE from 'three'
import { FACE_CAMERA_Y } from './layout.js'
import { mat, textTexture, FONT_DISPLAY, FONT_BODY } from './utils.js'

/**
 * Helper to build a district in local space.
 * Local axes: +X = screen right, +Z = toward the camera (front), -Z = back.
 * Everything built with a front face on +Z will face the viewer.
 */
export class AreaBuilder
{
    constructor(game, centerX, centerZ)
    {
        this.game = game
        this.physics = game.physics
        this.batch = game.batch
        this.root = new THREE.Group()
        this.root.position.set(centerX, 0, centerZ)
        this.root.rotation.y = FACE_CAMERA_Y
        this.root.updateMatrixWorld(true)
        game.scene.add(this.root)
        this._v = new THREE.Vector3()
    }

    world(x, y, z)
    {
        return this.root.localToWorld(new THREE.Vector3(x, y, z))
    }

    // Static mesh merged into the global batch
    static(mesh, { collider = false, halfExtents = null, rotationY = 0 } = {})
    {
        this.root.add(mesh)
        mesh.updateMatrixWorld(true)
        const worldPosition = mesh.getWorldPosition(new THREE.Vector3())
        this.batch.addMesh(mesh)
        this.root.remove(mesh)

        if(collider)
            this.physics.addFixedBox(worldPosition, halfExtents, FACE_CAMERA_Y + rotationY)
        return mesh
    }

    // Animated or textured mesh kept as its own object
    dynamicMesh(mesh)
    {
        this.root.add(mesh)
        mesh.castShadow = true
        mesh.receiveShadow = true
        return mesh
    }

    box(w, h, d, color, x, y, z, { rotationY = 0, collider = true, material = null } = {})
    {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material ?? mat(color))
        mesh.position.set(x, y, z)
        mesh.rotation.y = rotationY
        return this.static(mesh, { collider, halfExtents: { x: w / 2, y: h / 2, z: d / 2 }, rotationY })
    }

    cylinder(radiusTop, radiusBottom, height, color, x, y, z, { collider = true, segments = 12 } = {})
    {
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat(color))
        mesh.position.set(x, y, z)
        this.root.add(mesh)
        mesh.updateMatrixWorld(true)
        this.batch.addMesh(mesh)
        this.root.remove(mesh)
        if(collider)
            this.physics.addFixedCylinder(this.world(x, y, z), height / 2, Math.max(radiusTop, radiusBottom))
        return mesh
    }

    // Plaza floor of the district
    floor(color, size = 36)
    {
        const geometry = new THREE.PlaneGeometry(size, size)
        geometry.rotateX(-Math.PI / 2)
        const material = new THREE.MeshLambertMaterial({ color })
        this.game.weather?.registerGround(material, 0.6)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.y = 0.03
        mesh.rotation.y = -FACE_CAMERA_Y // keep the square aligned with the city grid
        this.static(mesh)
    }

    // Text painted on the ground, readable from the camera
    groundText(lines, x, z, width, { color = '#1d1b2f', height = null, sizes = null, opacity = 0.85 } = {})
    {
        const canvasWidth = 1024
        const canvasHeight = height ? Math.round(canvasWidth * height / width) : 256
        const texture = textTexture(lines, {
            width: canvasWidth,
            height: canvasHeight,
            background: null,
            color,
            sizes: sizes ?? (Array.isArray(lines) && lines.length > 1 ? [ canvasHeight * 0.4, canvasHeight * 0.22 ] : [ canvasHeight * 0.7 ])
        })
        const planeHeight = width * canvasHeight / canvasWidth
        const geometry = new THREE.PlaneGeometry(width, planeHeight)
        geometry.rotateX(-Math.PI / 2)
        const material = new THREE.MeshLambertMaterial({
            map: texture,
            transparent: true,
            opacity,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -2,
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, 0.05, z)
        mesh.receiveShadow = true
        mesh.renderOrder = 1
        this.root.add(mesh)
        return mesh
    }

    // Board on posts with a canvas texture on the front
    sign(lines, w, h, x, y, z, { background = '#ffffff', color = '#1d1b2f', frame = '#3b3a4d', posts = true, rotationY = 0, sizes = null, depth = 0.25 } = {})
    {
        const pixelsPerUnit = 110
        const texture = textTexture(lines, {
            width: Math.round(w * pixelsPerUnit),
            height: Math.round(h * pixelsPerUnit),
            background,
            color,
            sizes,
            radius: 16,
            padding: 6
        })
        const face = new THREE.MeshLambertMaterial({ map: texture, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: 0.12 })
        const frameMaterial = mat(frame)
        const board = new THREE.Mesh(
            new THREE.BoxGeometry(w, h, depth),
            [ frameMaterial, frameMaterial, frameMaterial, frameMaterial, face, frameMaterial ]
        )
        board.position.set(x, y, z)
        board.rotation.y = rotationY
        board.castShadow = true
        this.root.add(board)

        if(posts)
        {
            const bottom = y - h / 2
            const offset = w / 2 - 0.3
            for(const side of [ -1, 1 ])
            {
                const px = x + Math.cos(rotationY) * side * offset
                const pz = z - Math.sin(rotationY) * side * offset
                this.box(0.18, bottom, 0.18, frame, px, bottom / 2, pz, { rotationY })
            }
        }
        return board
    }

    tree(x, z, scale = 1, color = null)
    {
        const p = this.world(x, 0, z)
        this.game.city.addTree(p.x, p.z, scale, color)
    }

    lamp(x, z)
    {
        const p = this.world(x, 0, z)
        this.game.city.addLamp(p.x, p.z)
    }

    // Pushable object; colliders are in the mesh's local space
    pushable(mesh, x, y, z, colliders, options = {})
    {
        const p = this.world(x, y, z)
        mesh.position.copy(p)
        mesh.quaternion.setFromEuler(new THREE.Euler(0, FACE_CAMERA_Y + (options.rotationY ?? 0), 0))
        mesh.castShadow = true
        mesh.receiveShadow = true
        this.game.scene.add(mesh)
        return this.physics.addDynamic(mesh, colliders, options)
    }

    labelTexture(text, { background = '#ffffff', color = '#1d1b2f', size = 256 } = {})
    {
        return textTexture(text, { width: size, height: size, background, color, sizes: [ size * 0.24 ], radius: 18, font: FONT_DISPLAY })
    }
}

export { FONT_DISPLAY, FONT_BODY }
