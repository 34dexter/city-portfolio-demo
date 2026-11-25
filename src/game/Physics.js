import * as THREE from 'three'

let RAPIER = null

export class Physics
{
    static async create()
    {
        // Loaded as a separate chunk: the WASM physics engine is the biggest download
        RAPIER = (await import('@dimforge/rapier3d-compat')).default
        await RAPIER.init()
        return new Physics()
    }

    constructor()
    {
        this.RAPIER = RAPIER
        this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
        this.dynamics = []
        this._quat = new THREE.Quaternion()
        this._euler = new THREE.Euler()
    }

    quaternionFromY(rotationY = 0)
    {
        this._quat.setFromEuler(this._euler.set(0, rotationY, 0))
        return { x: this._quat.x, y: this._quat.y, z: this._quat.z, w: this._quat.w }
    }

    /**
     * Fixed (static) colliders
     */
    addFixedBox(position, halfExtents, rotationY = 0, { friction = 0.4, restitution = 0.15, quaternion = null } = {})
    {
        const body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.fixed()
                .setTranslation(position.x, position.y, position.z)
                .setRotation(quaternion ?? this.quaternionFromY(rotationY))
        )
        this.world.createCollider(
            RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
                .setFriction(friction)
                .setRestitution(restitution),
            body
        )
        return body
    }

    addFixedCylinder(position, halfHeight, radius)
    {
        const body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z)
        )
        this.world.createCollider(RAPIER.ColliderDesc.cylinder(halfHeight, radius).setFriction(0.4), body)
        return body
    }

    /**
     * Dynamic object synced to a mesh.
     * colliders: [{ shape: 'box'|'ball'|'cylinder', size: [...], offset: {x,y,z} }]
     */
    addDynamic(object3D, colliders, { mass = 1, friction = 0.4, restitution = 0.2, linearDamping = 0.1, angularDamping = 0.1, sleeping = true } = {})
    {
        object3D.updateMatrixWorld()
        const body = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic()
                .setTranslation(object3D.position.x, object3D.position.y, object3D.position.z)
                .setRotation({ x: object3D.quaternion.x, y: object3D.quaternion.y, z: object3D.quaternion.z, w: object3D.quaternion.w })
                .setLinearDamping(linearDamping)
                .setAngularDamping(angularDamping)
                .setSleeping(sleeping)
        )

        for(const collider of colliders)
        {
            let desc = null
            if(collider.shape === 'box') desc = RAPIER.ColliderDesc.cuboid(...collider.size)
            else if(collider.shape === 'ball') desc = RAPIER.ColliderDesc.ball(...collider.size)
            else if(collider.shape === 'cylinder') desc = RAPIER.ColliderDesc.cylinder(...collider.size)

            if(collider.offset)
                desc.setTranslation(collider.offset.x, collider.offset.y, collider.offset.z)

            desc.setMass(mass / colliders.length).setFriction(friction).setRestitution(restitution)
            this.world.createCollider(desc, body)
        }

        const item = {
            body,
            object3D,
            initial: {
                position: object3D.position.clone(),
                quaternion: object3D.quaternion.clone()
            }
        }
        this.dynamics.push(item)
        return item
    }

    resetItem(item)
    {
        const { position, quaternion } = item.initial
        item.body.setTranslation(position, false)
        item.body.setRotation(quaternion, false)
        item.body.setLinvel({ x: 0, y: 0, z: 0 }, false)
        item.body.setAngvel({ x: 0, y: 0, z: 0 }, false)
        item.body.sleep()
        item.object3D.position.copy(position)
        item.object3D.quaternion.copy(quaternion)
    }

    resetAll()
    {
        for(const item of this.dynamics)
            this.resetItem(item)
    }

    step(timestep)
    {
        this.world.timestep = timestep
        this.world.step()

        for(const item of this.dynamics)
        {
            if(item.body.isSleeping())
                continue

            const t = item.body.translation()
            const r = item.body.rotation()
            item.object3D.position.set(t.x, t.y, t.z)
            item.object3D.quaternion.set(r.x, r.y, r.z, r.w)

            // Fell off the world
            if(t.y < -15)
                this.resetItem(item)
        }
    }
}
