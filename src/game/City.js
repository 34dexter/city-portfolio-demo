import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { ROADS, ROAD_HALF_WIDTH, BLOCK_CENTERS, BLOCK_HALF, CITY_HALF, AREA_BLOCKS, PARK_BLOCKS } from './layout.js'
import { mat, createRandom, radialGlowTexture } from './utils.js'

const BUILDING_COLORS = [ '#f4c9a3', '#ec9f86', '#d6e6d0', '#c4dbec', '#f7e3b2', '#e9bccd', '#bccbea', '#f2d4a4', '#ffffff', '#d9c9f2' ]
const FOLIAGE_COLORS = [ '#6fbf5a', '#8ccf5e', '#5aa858', '#a3d16a', '#79b84f' ]

export class City
{
    constructor(game)
    {
        this.game = game
        this.scene = game.scene
        this.physics = game.physics
        this.batch = game.batch
        this.random = createRandom(2024)

        this.trees = []
        this.lamps = []
        this.nightMaterials = []

        this.setGround()
        this.setRoads()
        this.setBlocks()
        this.setLamps()
        this.setEdge()
    }

    // Lets the weather whiten this material when snow settles
    snowable(material, strength = 0.8)
    {
        this.game.weather?.registerGround(material, strength)
        return material
    }

    plane(width, depth, color, x, y, z, rotationY = 0)
    {
        const geometry = new THREE.PlaneGeometry(width, depth)
        geometry.rotateX(-Math.PI / 2)
        const matrix = new THREE.Matrix4().compose(
            new THREE.Vector3(x, y, z),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY),
            new THREE.Vector3(1, 1, 1)
        )
        this.groundBatch.push({ geometry, color, matrix })
    }

    setGround()
    {
        this.groundBatch = []

        // Land slab
        const slab = new THREE.Mesh(new THREE.BoxGeometry(CITY_HALF * 2, 2, CITY_HALF * 2), [
            mat('#c9a77a'), mat('#c9a77a'), this.snowable(new THREE.MeshLambertMaterial({ color: '#9fd07a' }), 0.9), mat('#c9a77a'), mat('#c9a77a'), mat('#c9a77a')
        ])
        slab.position.y = -1
        slab.receiveShadow = true
        this.scene.add(slab)

        // Water around the city
        const water = new THREE.Mesh(
            new THREE.PlaneGeometry(1200, 1200),
            new THREE.MeshLambertMaterial({ color: '#5cc6e6' })
        )
        water.rotation.x = -Math.PI / 2
        water.position.y = -0.9
        this.scene.add(water)
        this.water = water

        // Physical floor
        this.physics.addFixedBox({ x: 0, y: -1, z: 0 }, { x: CITY_HALF, y: 1, z: CITY_HALF }, 0, { friction: 0.25, restitution: 0 })
    }

    setRoads()
    {
        const length = CITY_HALF * 2 - 2
        const roadColor = '#4a4a5c'

        for(const r of ROADS)
        {
            this.plane(ROAD_HALF_WIDTH * 2, length, roadColor, r, 0.01, 0)
            this.plane(length, ROAD_HALF_WIDTH * 2, roadColor, 0, 0.012, r)
        }

        // Lane dashes between intersections
        for(const r of ROADS)
        {
            for(let i = 0; i < ROADS.length - 1; i++)
            {
                const start = ROADS[i] + ROAD_HALF_WIDTH + 2
                const end = ROADS[i + 1] - ROAD_HALF_WIDTH - 2
                for(let d = start; d < end; d += 6)
                {
                    this.plane(0.3, 3, '#f5efe0', r, 0.02, d + 1.5)
                    this.plane(3, 0.3, '#f5efe0', d + 1.5, 0.02, r)
                }
            }
        }

        // Crosswalks
        for(const x of ROADS)
        {
            for(const z of ROADS)
            {
                for(let s = -2; s <= 2; s++)
                {
                    const offset = s * 1.8
                    this.plane(0.9, 2.4, '#f5efe0', x + offset, 0.022, z + ROAD_HALF_WIDTH + 1.5)
                    this.plane(0.9, 2.4, '#f5efe0', x + offset, 0.022, z - ROAD_HALF_WIDTH - 1.5)
                    this.plane(2.4, 0.9, '#f5efe0', x + ROAD_HALF_WIDTH + 1.5, 0.022, z + offset)
                    this.plane(2.4, 0.9, '#f5efe0', x - ROAD_HALF_WIDTH - 1.5, 0.022, z + offset)
                }
            }
        }
    }

    setBlocks()
    {
        const areaKeys = new Set(Object.values(AREA_BLOCKS).map(([ x, z ]) => `${x},${z}`))
        this.buildingGeometries = []

        for(const bx of BLOCK_CENTERS)
        {
            for(const bz of BLOCK_CENTERS)
            {
                const key = `${bx},${bz}`
                // Sidewalk ring
                this.plane(BLOCK_HALF * 2, BLOCK_HALF * 2, '#dcd5c6', bx, 0.015, bz)

                if(areaKeys.has(key))
                    continue

                if(PARK_BLOCKS.includes(key))
                {
                    this.setPark(bx, bz)
                    continue
                }

                this.plane(BLOCK_HALF * 2 - 4, BLOCK_HALF * 2 - 4, '#bdb6a8', bx, 0.025, bz)
                this.setBuildingsInBlock(bx, bz)
            }
        }

        this.setBuildingsMesh()
    }

    setPark(bx, bz)
    {
        this.plane(BLOCK_HALF * 2 - 4, BLOCK_HALF * 2 - 4, '#8fcb6a', bx, 0.025, bz)

        // Pond
        const pond = new THREE.Mesh(new THREE.CircleGeometry(6, 24), mat('#63c8ea'))
        pond.rotation.x = -Math.PI / 2
        pond.position.set(bx - 4, 0.04, bz - 3)
        this.batch.addMesh(pond)

        // Paths
        this.plane(2.2, 34, '#e6d6b0', bx + 6, 0.03, bz)
        this.plane(34, 2.2, '#e6d6b0', bx, 0.032, bz + 7)

        for(let i = 0; i < 14; i++)
        {
            const x = bx + (this.random() - 0.5) * 32
            const z = bz + (this.random() - 0.5) * 32
            if(Math.hypot(x - (bx - 4), z - (bz - 3)) < 8) continue
            if(Math.abs(x - (bx + 6)) < 2.5 || Math.abs(z - (bz + 7)) < 2.5) continue
            this.addTree(x, z, 0.8 + this.random() * 0.6)
        }

        // Benches
        for(let i = 0; i < 3; i++)
            this.addBench(bx + 8.3, bz - 8 + i * 6, Math.PI / 2)
    }

    addBench(x, z, rotationY = 0)
    {
        const group = new THREE.Group()
        const wood = mat('#b5743f')
        const metal = mat('#3c3a4a')
        const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.6), wood)
        seat.position.y = 0.5
        const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.1), wood)
        back.position.set(0, 0.85, -0.28)
        const legA = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.55), metal)
        legA.position.set(-0.85, 0.25, 0)
        const legB = legA.clone()
        legB.position.x = 0.85
        group.add(seat, back, legA, legB)
        group.position.set(x, 0, z)
        group.rotation.y = rotationY
        group.updateMatrixWorld(true)
        group.children.forEach((child) => this.batch.addMesh(child))
        this.physics.addFixedBox({ x, y: 0.5, z }, { x: 1, y: 0.5, z: 0.3 }, rotationY)
    }

    setBuildingsInBlock(bx, bz)
    {
        const lots = [ [ -1, -1 ], [ 1, -1 ], [ -1, 1 ], [ 1, 1 ] ]
        const distance = Math.max(Math.abs(bx), Math.abs(bz))
        const tall = distance >= 100

        for(const [ lx, lz ] of lots)
        {
            const lotCenterX = bx + lx * 8.5
            const lotCenterZ = bz + lz * 8.5

            // Sometimes merge two lots into a wide building, sometimes leave a gap with a tree
            if(this.random() < 0.12)
            {
                this.addTree(lotCenterX, lotCenterZ, 1.1)
                continue
            }

            const w = 9 + this.random() * 6
            const d = 9 + this.random() * 6
            const h = (tall ? 10 : 6) + this.random() * (tall ? 22 : 12)
            const x = lotCenterX + (this.random() - 0.5) * (15 - w) * 0.8
            const z = lotCenterZ + (this.random() - 0.5) * (15 - d) * 0.8
            this.addBuilding(x, z, w, h, d, BUILDING_COLORS[Math.floor(this.random() * BUILDING_COLORS.length)])
        }
    }

    addBuilding(x, z, w, h, d, color, { windows = true, roofDetails = true } = {})
    {
        const geometry = new THREE.BoxGeometry(w, h, d)
        geometry.translate(x, h / 2, z)

        // Window UVs: one window cell every 3 units, the texture holds 4x4 cells
        const uv = geometry.attributes.uv
        const faceWidths = [ d, d, null, null, w, w ]
        for(let face = 0; face < 6; face++)
        {
            for(let v = 0; v < 4; v++)
            {
                const i = face * 4 + v
                if(faceWidths[face] === null || !windows)
                {
                    uv.setXY(i, 0.01, 0.99)
                }
                else
                {
                    const cellsX = Math.max(1, Math.round(faceWidths[face] / 3))
                    const cellsY = Math.max(1, Math.round(h / 3.2))
                    uv.setXY(i, uv.getX(i) * cellsX / 4, uv.getY(i) * cellsY / 4)
                }
            }
        }

        const tint = new THREE.Color(color)
        const colors = new Float32Array(geometry.attributes.position.count * 3)
        for(let i = 0; i < colors.length; i += 3)
        {
            colors[i] = tint.r
            colors[i + 1] = tint.g
            colors[i + 2] = tint.b
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        this.buildingGeometries.push(geometry)

        // Roof trim and details (rooftop water tanks, very Bangalore)
        const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.5, d + 0.4), mat('#8f8aa0'))
        trim.position.set(x, h + 0.25, z)
        this.batch.addMesh(trim)

        if(roofDetails)
        {
            if(!this.roofMaterial) this.roofMaterial = this.snowable(new THREE.MeshLambertMaterial({ color: '#b9b3c6', flatShading: true }), 0.9)
            const roof = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 0.1, d - 0.4), this.roofMaterial)
            roof.position.set(x, h + 0.5, z)
            this.batch.addMesh(roof)

            if(this.random() < 0.8)
            {
                const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10), mat('#2f3140'))
                tank.position.set(x + (this.random() - 0.5) * (w - 3), h + 1.3, z + (this.random() - 0.5) * (d - 3))
                this.batch.addMesh(tank)
            }
            if(this.random() < 0.6)
            {
                const unit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 1.2), mat('#e7e3ee'))
                unit.position.set(x + (this.random() - 0.5) * (w - 3), h + 1, z + (this.random() - 0.5) * (d - 3))
                this.batch.addMesh(unit)
            }
        }

        this.physics.addFixedBox({ x, y: h / 2, z }, { x: w / 2, y: h / 2, z: d / 2 })
    }

    setBuildingsMesh()
    {
        // Window texture: 4x4 cells, wall in white so vertex color tints it
        const size = 256
        const cell = size / 4
        const wallCanvas = document.createElement('canvas')
        wallCanvas.width = wallCanvas.height = size
        const wall = wallCanvas.getContext('2d')
        wall.fillStyle = '#ffffff'
        wall.fillRect(0, 0, size, size)

        const glowCanvas = document.createElement('canvas')
        glowCanvas.width = glowCanvas.height = size
        const glow = glowCanvas.getContext('2d')
        glow.fillStyle = '#000000'
        glow.fillRect(0, 0, size, size)

        for(let i = 0; i < 4; i++)
        {
            for(let j = 0; j < 4; j++)
            {
                const x = i * cell + 16
                const y = j * cell + 14
                wall.fillStyle = '#5d6f8f'
                wall.fillRect(x, y, cell - 32, cell - 26)
                wall.fillStyle = 'rgba(255,255,255,0.35)'
                wall.fillRect(x + 3, y + 3, 8, cell - 32)
                if(this.random() < 0.55)
                {
                    glow.fillStyle = this.random() < 0.7 ? '#ffcf7a' : '#fff1d0'
                    glow.fillRect(x, y, cell - 32, cell - 26)
                }
            }
        }

        const map = new THREE.CanvasTexture(wallCanvas)
        map.colorSpace = THREE.SRGBColorSpace
        map.wrapS = map.wrapT = THREE.RepeatWrapping
        map.anisotropy = 8
        const emissiveMap = new THREE.CanvasTexture(glowCanvas)
        emissiveMap.colorSpace = THREE.SRGBColorSpace
        emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping

        this.buildingMaterial = new THREE.MeshLambertMaterial({
            map,
            emissiveMap,
            emissive: '#ffffff',
            emissiveIntensity: 0,
            vertexColors: true
        })
        this.nightMaterials.push({ material: this.buildingMaterial, intensity: 1.1 })

        if(this.buildingGeometries.length)
        {
            const merged = mergeGeometries(this.buildingGeometries, false)
            const mesh = new THREE.Mesh(merged, this.buildingMaterial)
            mesh.castShadow = true
            mesh.receiveShadow = true
            mesh.matrixAutoUpdate = false
            this.scene.add(mesh)
        }
        this.buildingGeometries = []
    }

    setLamps()
    {
        // A lamp on each block corner
        for(const bx of BLOCK_CENTERS)
        {
            for(const bz of BLOCK_CENTERS)
            {
                for(const [ sx, sz ] of [ [ 1, 1 ], [ -1, 1 ], [ 1, -1 ], [ -1, -1 ] ])
                    this.addLamp(bx + sx * (BLOCK_HALF - 1), bz + sz * (BLOCK_HALF - 1))
            }
        }
    }

    addLamp(x, z)
    {
        this.lamps.push(new THREE.Vector3(x, 0, z))
    }

    addTree(x, z, scale = 1, color = null)
    {
        this.trees.push({ x, z, scale, color })
    }

    setEdge()
    {
        // Low sea wall around the land
        const height = 0.8
        const wallMat = mat('#e9dcc0')
        const sides = [
            [ 0, CITY_HALF, CITY_HALF * 2, 1 ],
            [ 0, -CITY_HALF, CITY_HALF * 2, 1 ],
            [ CITY_HALF, 0, 1, CITY_HALF * 2 ],
            [ -CITY_HALF, 0, 1, CITY_HALF * 2 ],
        ]
        for(const [ x, z, w, d ] of sides)
        {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, height, d), wallMat)
            wall.position.set(x, height / 2, z)
            this.batch.addMesh(wall)
            this.physics.addFixedBox({ x, y: 1.5, z }, { x: w / 2, y: 1.5, z: d / 2 })
        }
    }

    // Called once every district has added its trees and lamps
    finalize()
    {
        // Ground planes merged per color
        const byColor = new Map()
        for(const item of this.groundBatch)
        {
            const g = item.geometry
            g.applyMatrix4(item.matrix)
            if(!byColor.has(item.color)) byColor.set(item.color, [])
            byColor.get(item.color).push(g)
        }
        byColor.forEach((geometries, color) =>
        {
            const material = new THREE.MeshLambertMaterial({ color })
            // Roads and markings get a lighter dusting than grass and sidewalks
            const snowStrength = color === '#4a4a5c' ? 0.35 : color === '#f5efe0' ? 0 : 0.8
            if(snowStrength) this.snowable(material, snowStrength)
            const mesh = new THREE.Mesh(mergeGeometries(geometries, false), material)
            mesh.receiveShadow = true
            mesh.matrixAutoUpdate = false
            this.scene.add(mesh)
        })
        this.groundBatch = []

        this.setTreesMesh()
        this.setLampsMesh()
    }

    setTreesMesh()
    {
        const count = this.trees.length
        if(!count) return

        const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6)
        trunkGeometry.translate(0, 0.8, 0)
        const foliageGeometry = new THREE.IcosahedronGeometry(1.4, 0)
        foliageGeometry.translate(0, 2.6, 0)
        const topGeometry = new THREE.IcosahedronGeometry(0.9, 0)
        topGeometry.translate(0.3, 3.6, 0.2)
        const leaves = mergeGeometries([ foliageGeometry, topGeometry ]) // icosahedrons are already non-indexed

        const trunks = new THREE.InstancedMesh(trunkGeometry, mat('#8a5a3b'), count)
        const foliage = new THREE.InstancedMesh(leaves, new THREE.MeshLambertMaterial({ flatShading: true }), count)
        const dummy = new THREE.Object3D()
        const color = new THREE.Color()

        this.trees.forEach((tree, i) =>
        {
            dummy.position.set(tree.x, 0, tree.z)
            dummy.rotation.set(0, this.random() * Math.PI * 2, 0)
            dummy.scale.setScalar(tree.scale)
            dummy.updateMatrix()
            trunks.setMatrixAt(i, dummy.matrix)
            foliage.setMatrixAt(i, dummy.matrix)
            color.set(tree.color ?? FOLIAGE_COLORS[Math.floor(this.random() * FOLIAGE_COLORS.length)])
            foliage.setColorAt(i, color)

            this.physics.addFixedCylinder({ x: tree.x, y: 1, z: tree.z }, 1, 0.3 * tree.scale)
        })

        for(const mesh of [ trunks, foliage ])
        {
            mesh.castShadow = true
            mesh.receiveShadow = true
            mesh.instanceMatrix.needsUpdate = true
            this.scene.add(mesh)
        }
    }

    setLampsMesh()
    {
        const count = this.lamps.length
        const pole = new THREE.CylinderGeometry(0.09, 0.12, 4.2, 6)
        pole.translate(0, 2.1, 0)
        const arm = new THREE.BoxGeometry(0.9, 0.1, 0.1)
        arm.translate(0.4, 4.1, 0)
        const poleGeometry = mergeGeometries([ pole.toNonIndexed(), arm.toNonIndexed() ])
        const headGeometry = new THREE.BoxGeometry(0.55, 0.22, 0.4)
        headGeometry.translate(0.8, 4.0, 0)

        const poles = new THREE.InstancedMesh(poleGeometry, mat('#3b3a4d'), count)
        this.lampHeadMaterial = new THREE.MeshBasicMaterial({ color: '#d8d4c8' })
        const heads = new THREE.InstancedMesh(headGeometry, this.lampHeadMaterial, count)

        const glowGeometry = new THREE.PlaneGeometry(7, 7)
        glowGeometry.rotateX(-Math.PI / 2)
        glowGeometry.translate(0.8, 0.06, 0)
        this.lampGlowMaterial = new THREE.MeshBasicMaterial({
            map: radialGlowTexture('rgba(255,214,140,0.9)', 'rgba(255,190,110,0)'),
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            opacity: 0
        })
        const glows = new THREE.InstancedMesh(glowGeometry, this.lampGlowMaterial, count)

        const dummy = new THREE.Object3D()
        this.lamps.forEach((lamp, i) =>
        {
            dummy.position.copy(lamp)
            // Point the arm toward the nearest road
            dummy.rotation.set(0, this.armAngle(lamp), 0)
            dummy.updateMatrix()
            poles.setMatrixAt(i, dummy.matrix)
            heads.setMatrixAt(i, dummy.matrix)
            glows.setMatrixAt(i, dummy.matrix)
            this.physics.addFixedCylinder({ x: lamp.x, y: 2, z: lamp.z }, 2, 0.15)
        })

        poles.castShadow = true
        this.scene.add(poles, heads, glows)
    }

    armAngle(lamp)
    {
        // Find the closest road line and rotate the arm (+X local) toward it
        let best = null
        for(const r of ROADS)
        {
            const dx = Math.abs(lamp.x - r)
            const dz = Math.abs(lamp.z - r)
            if(!best || dx < best.distance) best = { distance: dx, angle: r > lamp.x ? 0 : Math.PI }
            if(dz < best.distance) best = { distance: dz, angle: r > lamp.z ? -Math.PI / 2 : Math.PI / 2 }
        }
        return best.angle
    }

    update(night)
    {
        for(const item of this.nightMaterials)
            item.material.emissiveIntensity = night * item.intensity

        if(this.lampHeadMaterial)
        {
            this.lampHeadMaterial.color.setRGB(0.85 + night * 0.15, 0.83 + night * 0.07, 0.78 - night * 0.2)
            this.lampGlowMaterial.opacity = night * 0.85
        }
    }
}
