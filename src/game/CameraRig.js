import * as THREE from 'three'
import gsap from 'gsap'
import { clamp, lerp, smoothstep } from './utils.js'

const MAP_FOV = 25
const FIRST_PERSON_FOV = 68
// Eye position in car space (+X = forward): just above the hood, in front of the windshield
const EYE_OFFSET = new THREE.Vector3(0.55, 0.5, 0)
// Cameras look down -Z; the car drives along +X
const CAMERA_TO_CAR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)

/**
 * Two camera modes:
 * - 'map': fixed-angle follow camera looking down at the car from +X+Z with a narrow lens.
 *   Scroll to zoom, drag to pan, zooms out when driving fast.
 * - 'firstPerson': driver's view over the hood. Drag to look around.
 * Opening a district always blends to the map-style framing so the panel layout stays the same.
 */
export class CameraRig
{
    constructor(game)
    {
        this.game = game
        this.camera = new THREE.PerspectiveCamera(MAP_FOV, window.innerWidth / window.innerHeight, 1, 450)

        this.mode = 'map'
        this.firstPersonBlend = 0 // 0 = map, 1 = first person (animated)

        this.phi = Math.PI * 0.31
        this.theta = Math.PI * 0.25
        this.radiusMin = 16
        this.radiusMax = 50
        this.zoom = 0.25 // 0 = far, 1 = close
        this.smoothedZoom = 0.2
        this.focus = new THREE.Vector3()
        this.smoothedFocus = new THREE.Vector3()
        this.tracking = true
        this.offset = new THREE.Vector3()
        this.cinematic = { progress: 0, target: new THREE.Vector3(), radius: 46 }
        this.shake = 0

        // First person state
        this.firstPerson = {
            position: new THREE.Vector3(),
            quaternion: new THREE.Quaternion(),
            target: new THREE.Quaternion(),
            look: new THREE.Quaternion(),
            yaw: 0,
            pitch: 0,
            dragging: false,
            snap: true,
            fov: FIRST_PERSON_FOV
        }

        this.mapPosition = new THREE.Vector3()
        this.mapQuaternion = new THREE.Quaternion()
        this._euler = new THREE.Euler(0, 0, 0, 'YXZ')

        this.setPointer()
        window.addEventListener('wheel', (event) =>
        {
            if(this.mode !== 'map') return
            if(event.target.closest && event.target.closest('.panel, .menu')) return
            this.zoom = clamp(this.zoom - Math.sign(event.deltaY) * 0.06, 0, 1)
        }, { passive: true })
    }

    get ratioOverflow()
    {
        // Portrait screens need more distance to see the same area
        return Math.max(1, (16 / 9) / (window.innerWidth / window.innerHeight)) - 1
    }

    setPointer()
    {
        const canvas = this.game.canvas
        let dragging = false
        let last = { x: 0, y: 0 }
        canvas.addEventListener('pointerdown', (event) =>
        {
            if(event.pointerType === 'touch' && !event.isPrimary) return
            dragging = true
            this.firstPerson.dragging = true
            last = { x: event.clientX, y: event.clientY }
        })
        window.addEventListener('pointerup', () =>
        {
            dragging = false
            this.firstPerson.dragging = false
        })
        window.addEventListener('pointermove', (event) =>
        {
            if(!dragging || this.cinematic.progress > 0.01) return
            const dx = event.clientX - last.x
            const dy = event.clientY - last.y
            last = { x: event.clientX, y: event.clientY }
            if(Math.hypot(dx, dy) < 0.5) return

            // First person: look around
            if(this.mode === 'firstPerson')
            {
                const fp = this.firstPerson
                const sensitivity = 3 / Math.min(window.innerWidth, window.innerHeight)
                fp.yaw = clamp(fp.yaw - dx * sensitivity, -Math.PI * 0.75, Math.PI * 0.75)
                fp.pitch = clamp(fp.pitch - dy * sensitivity, -0.6, 0.5)
                return
            }

            // Map: pan
            this.tracking = false
            const move = new THREE.Vector2(dx, dy).rotateAround(new THREE.Vector2(), -this.theta)
            const scale = 22 / Math.min(window.innerWidth, window.innerHeight)
            this.focus.x -= move.x * scale * 2
            this.focus.z -= move.y * scale * 2
        })
    }

    setMode(mode)
    {
        if(mode === this.mode) return
        this.mode = mode
        this.tracking = true
        if(mode === 'firstPerson')
        {
            this.firstPerson.yaw = 0
            this.firstPerson.pitch = 0
            this.firstPerson.snap = true
        }
        gsap.to(this, { firstPersonBlend: mode === 'firstPerson' ? 1 : 0, duration: 1.2, ease: 'power2.inOut', overwrite: true })
    }

    toggleMode()
    {
        this.setMode(this.mode === 'map' ? 'firstPerson' : 'map')
        return this.mode
    }

    snapTo(position)
    {
        this.focus.set(position.x, 0, position.z)
        this.smoothedFocus.copy(this.focus)
        this.firstPerson.snap = true
    }

    startCinematic(target)
    {
        this.cinematic.target.copy(target)
        gsap.to(this.cinematic, { progress: 1, duration: 1.4, ease: 'power2.inOut', overwrite: true })
    }

    endCinematic()
    {
        this.firstPerson.snap = true
        gsap.to(this.cinematic, { progress: 0, duration: 1, ease: 'power2.inOut', overwrite: true })
    }

    resize()
    {
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
    }

    updateMap(delta, carPosition)
    {
        if(this.tracking)
            this.focus.set(carPosition.x, 0, carPosition.z)

        const previous = this.smoothedFocus.clone()
        this.smoothedFocus.lerp(this.focus, Math.min(1, delta * 6))
        const focusSpeed = previous.distanceTo(this.smoothedFocus) / Math.max(delta, 0.0001)

        // Zoom out with speed
        const speedEffect = this.tracking ? smoothstep(focusSpeed, 6, 30) * 0.35 : 0
        this.smoothedZoom = lerp(this.smoothedZoom, this.zoom - speedEffect, Math.min(1, delta * 3))

        const radiusMax = this.radiusMax + this.ratioOverflow * 14
        let radius = lerp(radiusMax, this.radiusMin, clamp(this.smoothedZoom, 0, 1))
        const target = this.smoothedFocus.clone()

        // Blend toward cinematic framing when an area is open
        const c = this.cinematic.progress
        if(c > 0)
        {
            target.lerp(this.cinematic.target, c)
            radius = lerp(radius, this.cinematic.radius + this.ratioOverflow * 10, c)
        }

        this.offset.setFromSphericalCoords(radius, this.phi, this.theta)
        this.camera.position.copy(target).add(this.offset)
        this.camera.lookAt(target)
        this.mapPosition.copy(this.camera.position)
        this.mapQuaternion.copy(this.camera.quaternion)
    }

    updateFirstPerson(delta, vehicle)
    {
        const fp = this.firstPerson

        // Eye follows the car body exactly so the hood never drifts in the frame
        fp.position.copy(EYE_OFFSET).applyQuaternion(vehicle.quaternion).add(vehicle.position)

        // Look direction: car orientation plus the drag offset, smoothed to soften suspension bounce
        fp.look.setFromEuler(this._euler.set(fp.pitch, fp.yaw, 0, 'YXZ'))
        fp.target.copy(vehicle.quaternion).multiply(CAMERA_TO_CAR).multiply(fp.look)
        if(fp.snap)
        {
            fp.quaternion.copy(fp.target)
            fp.snap = false
        }
        else
        {
            fp.quaternion.slerp(fp.target, Math.min(1, delta * 14))
        }

        // Ease the look offset back to the road once the player lets go and drives
        if(!fp.dragging && vehicle.speed > 1)
        {
            const ease = Math.min(1, delta * 1.5)
            fp.yaw = lerp(fp.yaw, 0, ease)
            fp.pitch = lerp(fp.pitch, 0, ease)
        }

        // Wider lens at speed
        const speedFov = smoothstep(vehicle.speed, 5, 30) * 12
        fp.fov = lerp(fp.fov, FIRST_PERSON_FOV + speedFov, Math.min(1, delta * 3))
    }

    update(delta, vehicle)
    {
        this.updateMap(delta, vehicle.position)

        // First person weight drops to 0 while a district panel is open
        const weight = this.firstPersonBlend * (1 - this.cinematic.progress)
        let fov = MAP_FOV
        let near = 1

        if(this.firstPersonBlend > 0)
        {
            this.updateFirstPerson(delta, vehicle)
            this.camera.position.lerpVectors(this.mapPosition, this.firstPerson.position, weight)
            this.camera.quaternion.slerpQuaternions(this.mapQuaternion, this.firstPerson.quaternion, weight)
            fov = lerp(MAP_FOV, this.firstPerson.fov, weight)
            near = lerp(1, 0.08, weight)
        }

        if(this.camera.fov !== fov || this.camera.near !== near)
        {
            this.camera.fov = fov
            this.camera.near = near
            this.camera.updateProjectionMatrix()
        }

        // Small roll shake on impacts
        if(this.shake > 0)
        {
            this.camera.rotateZ((Math.random() - 0.5) * this.shake * 0.02)
            this.shake = Math.max(0, this.shake - delta * 4)
        }
    }
}
