import * as THREE from 'three'
import { lerp, mat } from './utils.js'

// Driving feel adapted from the folio-2025 raycast vehicle tuning (MIT, Bruno Simon).
const SETTINGS = {
    steeringAmplitude: 0.5,
    engineForceAmplitude: 300,
    boostMultiplier: 2,
    topSpeed: 5,
    topSpeedBoost: 30,
    brakeAmplitude: 35,
    idleBrake: 0.06,
    reverseBrake: 0.4,
    wheel: {
        offset: { x: 0.9, y: 0, z: 0.75 },
        radius: 0.4,
        frictionSlip: 0.9,
        maxSuspensionForce: 150,
        maxSuspensionTravel: 2,
        sideFrictionStiffness: 3,
        suspensionCompression: 10,
        suspensionRelaxation: 2.7,
    },
    suspension: {
        low: { length: 0.88, stiffness: 20 },
        high: { length: 1.63, stiffness: 40 },
    }
}

export class Vehicle
{
    constructor(game)
    {
        this.game = game
        this.physics = game.physics
        const RAPIER = this.physics.RAPIER

        this.position = new THREE.Vector3(0, 4, 0)
        this.quaternion = new THREE.Quaternion()
        this.velocity = new THREE.Vector3()
        this.forward = new THREE.Vector3(1, 0, 0)
        this.upward = new THREE.Vector3(0, 1, 0)
        this.speed = 0
        this.forwardSpeed = 0
        this.goingForward = true
        this.wheelsInContact = 0
        this.upsideDownTime = 0
        this.lastFlipTime = -10
        this.nightFactor = 0

        // Chassis
        this.body = this.physics.world.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(0, 4, 0)
                .setCanSleep(false)
                .setLinearDamping(0.1)
                .setAngularDamping(0.1)
        )
        this.physics.world.createCollider(
            RAPIER.ColliderDesc.cuboid(1.3, 0.4, 0.85)
                .setTranslation(0, -0.1, 0)
                .setMassProperties(2.5, { x: 0, y: -0.5, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0, w: 1 })
                .setFriction(0.4)
                .setRestitution(0.15),
            this.body
        )
        this.physics.world.createCollider(
            RAPIER.ColliderDesc.cuboid(0.5, 0.15, 0.65).setTranslation(-0.15, 0.4, 0).setMass(0).setFriction(0.4),
            this.body
        )
        this.mass = this.body.mass()

        // Raycast vehicle controller
        this.controller = this.physics.world.createVehicleController(this.body)
        const w = SETTINGS.wheel
        this.wheels = []
        this.grip = 1 // lowered by rain and snow
        const offsets = [
            [ w.offset.x, w.offset.z ], [ w.offset.x, -w.offset.z ],
            [ -w.offset.x, w.offset.z ], [ -w.offset.x, -w.offset.z ],
        ]
        offsets.forEach(([ x, z ], i) =>
        {
            const connection = { x, y: w.offset.y, z }
            this.controller.addWheel(connection, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, SETTINGS.suspension.low.length, w.radius)
            this.controller.setWheelFrictionSlip(i, w.frictionSlip)
            this.controller.setWheelMaxSuspensionForce(i, w.maxSuspensionForce)
            this.controller.setWheelMaxSuspensionTravel(i, w.maxSuspensionTravel)
            this.controller.setWheelSideFrictionStiffness(i, w.sideFrictionStiffness)
            this.controller.setWheelSuspensionCompression(i, w.suspensionCompression)
            this.controller.setWheelSuspensionRelaxation(i, w.suspensionRelaxation)
            this.controller.setWheelSuspensionStiffness(i, SETTINGS.suspension.low.stiffness)
            this.wheels.push({ connection, spin: 0, visual: null })
        })

        this.setVisual()
    }

    setVisual()
    {
        const group = new THREE.Group()
        this.group = group
        this.game.scene.add(group)

        const paint = mat('#ff5a4e')
        const white = mat('#fff6ea')
        const dark = mat('#2a2838')
        const glass = mat('#7fd3ff', { emissive: '#1b4a6b' })

        const add = (geometry, material, x, y, z) =>
        {
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, y, z)
            mesh.castShadow = true
            mesh.receiveShadow = true
            group.add(mesh)
            return mesh
        }

        // Body
        add(new THREE.BoxGeometry(2.6, 0.5, 1.6), paint, 0, -0.2, 0)
        add(new THREE.BoxGeometry(1.2, 0.1, 0.36), white, 0.7, 0.07, 0) // hood stripe
        add(new THREE.BoxGeometry(1.35, 0.55, 1.34), white, -0.2, 0.3, 0) // cabin
        add(new THREE.BoxGeometry(1.0, 0.36, 1.38), glass, -0.15, 0.32, 0) // side windows
        add(new THREE.BoxGeometry(1.39, 0.36, 1.0), glass, -0.2, 0.32, 0) // front/back windows
        add(new THREE.BoxGeometry(1.45, 0.08, 1.42), paint, -0.2, 0.6, 0) // roof
        add(new THREE.BoxGeometry(0.16, 0.22, 1.7), dark, 1.36, -0.32, 0) // front bumper
        add(new THREE.BoxGeometry(0.16, 0.22, 1.7), dark, -1.36, -0.32, 0) // rear bumper

        // Lights
        this.headlightMaterial = new THREE.MeshBasicMaterial({ color: '#fff3c4' })
        this.taillightMaterial = new THREE.MeshBasicMaterial({ color: '#ff3048' })
        add(new THREE.BoxGeometry(0.08, 0.16, 0.34), this.headlightMaterial, 1.31, -0.1, 0.52)
        add(new THREE.BoxGeometry(0.08, 0.16, 0.34), this.headlightMaterial, 1.31, -0.1, -0.52)
        add(new THREE.BoxGeometry(0.08, 0.14, 0.3), this.taillightMaterial, -1.31, -0.08, 0.55)
        add(new THREE.BoxGeometry(0.08, 0.14, 0.3), this.taillightMaterial, -1.31, -0.08, -0.55)

        // Little roof sign with initials
        const signCanvas = document.createElement('canvas')
        signCanvas.width = 128
        signCanvas.height = 64
        const ctx = signCanvas.getContext('2d')
        ctx.fillStyle = '#ffd23f'
        ctx.fillRect(0, 0, 128, 64)
        ctx.fillStyle = '#1d1b2f'
        ctx.font = '700 44px "Fredoka", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('PB', 64, 34)
        const signTexture = new THREE.CanvasTexture(signCanvas)
        signTexture.colorSpace = THREE.SRGBColorSpace
        const signMaterial = new THREE.MeshLambertMaterial({ map: signTexture })
        const sign = add(new THREE.BoxGeometry(0.5, 0.28, 0.06), [ mat('#ffd23f'), mat('#ffd23f'), mat('#ffd23f'), mat('#ffd23f'), signMaterial, signMaterial ], -0.2, 0.8, 0)
        sign.rotation.y = Math.PI / 2

        // Headlight beam (only visible at night)
        this.headlight = new THREE.SpotLight('#fff1c9', 0, 28, 0.55, 0.5, 1.2)
        this.headlight.position.set(1.2, 0, 0)
        this.headlight.target.position.set(8, -1.6, 0)
        group.add(this.headlight, this.headlight.target)

        // Wheels
        const tire = new THREE.CylinderGeometry(0.4, 0.4, 0.34, 14)
        tire.rotateX(Math.PI / 2)
        const hub = new THREE.CylinderGeometry(0.2, 0.2, 0.36, 8)
        hub.rotateX(Math.PI / 2)
        for(const wheel of this.wheels)
        {
            const holder = new THREE.Group()
            const spinner = new THREE.Group()
            const tireMesh = new THREE.Mesh(tire, dark)
            const hubMesh = new THREE.Mesh(hub, white)
            tireMesh.castShadow = true
            spinner.add(tireMesh, hubMesh)
            holder.add(spinner)
            group.add(holder)
            wheel.visual = { holder, spinner }
        }
    }

    moveTo(position, rotationY = 0)
    {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)
        this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true)
        this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true)
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        this.position.copy(position)
        this.quaternion.copy(q)
        this.syncVisual()
    }

    prePhysics(input, deltaScaled, deltaReal)
    {
        // Engine
        const topSpeed = lerp(SETTINGS.topSpeed, SETTINGS.topSpeedBoost, input.boosting)
        const overflowSpeed = Math.max(0, this.speed - topSpeed)
        let engineForce = input.accelerating * (1 + input.boosting * SETTINGS.boostMultiplier) * SETTINGS.engineForceAmplitude / (1 + overflowSpeed) * deltaScaled

        // Brake
        let brake = input.braking
        if(!input.braking && Math.abs(input.accelerating) < 0.1)
            brake = SETTINGS.idleBrake

        if(this.speed > 0.5 && ((input.accelerating > 0 && !this.goingForward) || (input.accelerating < 0 && this.goingForward)))
        {
            brake = SETTINGS.reverseBrake
            engineForce = 0
        }
        brake *= SETTINGS.brakeAmplitude * deltaScaled

        // Steering
        const steer = input.steering * SETTINGS.steeringAmplitude
        this.controller.setWheelSteering(0, steer)
        this.controller.setWheelSteering(1, steer)

        const suspension = input.jumping ? SETTINGS.suspension.high : SETTINGS.suspension.low
        for(let i = 0; i < 4; i++)
        {
            this.controller.setWheelBrake(i, brake)
            this.controller.setWheelEngineForce(i, engineForce)
            this.controller.setWheelSuspensionRestLength(i, suspension.length)
            this.controller.setWheelSuspensionStiffness(i, suspension.stiffness)
            this.controller.setWheelFrictionSlip(i, SETTINGS.wheel.frictionSlip * this.grip)
        }

        this.controller.updateVehicle(Math.min(1 / 60, deltaReal))
        this.steer = steer
    }

    postPhysics(deltaScaled, deltaReal, elapsed)
    {
        const t = this.body.translation()
        const r = this.body.rotation()
        const newPosition = new THREE.Vector3(t.x, t.y, t.z)
        this.velocity.copy(newPosition).sub(this.position)
        this.position.copy(newPosition)
        this.quaternion.set(r.x, r.y, r.z, r.w)
        this.forward.set(1, 0, 0).applyQuaternion(this.quaternion)
        this.upward.set(0, 1, 0).applyQuaternion(this.quaternion)

        this.speed = this.velocity.length() / deltaScaled
        this.xzSpeed = Math.hypot(this.velocity.x, this.velocity.z) / deltaScaled
        const direction = this.velocity.clone().normalize()
        this.forwardRatio = direction.dot(this.forward)
        this.goingForward = this.forwardRatio > 0.5
        this.forwardDistance = this.velocity.dot(this.forward)

        let inContact = 0
        for(let i = 0; i < 4; i++)
            if(this.controller.wheelIsInContact(i)) inContact++
        this.wheelsInContact = inContact

        // Upside down: flip back after a short delay
        const upsideDownRatio = this.upward.dot(new THREE.Vector3(0, -1, 0)) * 0.5 + 0.5
        if(upsideDownRatio > 0.3 && this.speed < 2)
            this.upsideDownTime += deltaReal
        else
            this.upsideDownTime = 0

        if(this.upsideDownTime > 1.5 && elapsed - this.lastFlipTime > 1.5)
        {
            this.flipBack()
            this.lastFlipTime = elapsed
            this.upsideDownTime = 0
        }

        this.syncVisual()
    }

    flipBack()
    {
        const up = new THREE.Vector3(0, 1, 0)
        const sideward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quaternion)
        const sidewardDot = up.dot(sideward)
        const forwardDot = up.dot(this.forward)
        const upwardDot = up.dot(this.upward)

        this.body.applyImpulse({ x: 0, y: 5 * this.mass, z: 0 }, true)

        const torque = Math.abs(upwardDot) > Math.abs(sidewardDot) && Math.abs(upwardDot) > Math.abs(forwardDot)
            ? new THREE.Vector3(0.8 * this.mass, 0, 0)
            : new THREE.Vector3(sidewardDot * 0.4 * this.mass, 0, -forwardDot * 0.8 * this.mass)
        torque.applyQuaternion(this.quaternion)
        this.body.applyTorqueImpulse({ x: torque.x, y: torque.y, z: torque.z }, true)
    }

    syncVisual()
    {
        this.group.position.copy(this.position)
        this.group.quaternion.copy(this.quaternion)

        for(let i = 0; i < 4; i++)
        {
            const wheel = this.wheels[i]
            const suspensionLength = this.controller.wheelSuspensionLength(i) ?? SETTINGS.suspension.low.length
            wheel.visual.holder.position.set(wheel.connection.x, wheel.connection.y - suspensionLength, wheel.connection.z)
            wheel.visual.holder.rotation.y = i < 2 ? (this.steer ?? 0) : 0
            wheel.spin -= (this.forwardDistance ?? 0) / SETTINGS.wheel.radius
            wheel.visual.spinner.rotation.z = wheel.spin
        }
    }

    setNight(factor)
    {
        this.nightFactor = factor
        this.headlight.intensity = factor * 60
    }
}
