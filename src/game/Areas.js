import * as THREE from 'three'
import { AreaBuilder } from './AreaBuilder.js'
import { AREA_BLOCKS, FACE_CAMERA_Y } from './layout.js'
import { labelSprite } from './utils.js'
import { contactLinks } from '../ui/content.js'
import {
    buildLanding, buildSkills, buildInternship, buildHudl, buildEducation,
    buildEventPlanner, buildBoneCancer, buildSolarTracker, buildContact
} from './districts.js'

const BUILDERS = {
    landing: buildLanding,
    skills: buildSkills,
    internship: buildInternship,
    hudl: buildHudl,
    education: buildEducation,
    eventPlanner: buildEventPlanner,
    boneCancer: buildBoneCancer,
    solarTracker: buildSolarTracker,
    contact: buildContact,
}

const INTERACT_RADIUS = 3.6
const DISCOVER_RADIUS = 21

export class Areas
{
    constructor(game)
    {
        this.game = game
        this.items = []
        this.active = null

        const stored = JSON.parse(localStorage.getItem('discovered') ?? '[]')
        this.discovered = new Set(stored)

        for(const [ name, [ x, z ] ] of Object.entries(AREA_BLOCKS))
        {
            const builder = new AreaBuilder(game, x, z)
            const description = BUILDERS[name](builder, game, contactLinks())
            this.items.push(this.createArea(name, builder, description))
        }

        this.landing = this.items.find((item) => item.name === 'landing')
    }

    createArea(name, builder, description)
    {
        const point = builder.world(description.point.x, 0, description.point.z)
        const center = builder.world(0, 0, 0)

        // Ground marker
        const ringGeometry = new THREE.RingGeometry(1.6, 2, 40)
        ringGeometry.rotateX(-Math.PI / 2)
        const ringMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false })
        const ring = new THREE.Mesh(ringGeometry, ringMaterial)
        ring.position.set(point.x, 0.07, point.z)
        ring.renderOrder = 2

        const discGeometry = new THREE.CircleGeometry(1.6, 40)
        discGeometry.rotateX(-Math.PI / 2)
        const discMaterial = new THREE.MeshBasicMaterial({ color: '#1d1b2f', transparent: true, opacity: 0.25, depthWrite: false })
        const disc = new THREE.Mesh(discGeometry, discMaterial)
        disc.position.set(point.x, 0.065, point.z)
        disc.renderOrder = 2
        this.game.scene.add(ring, disc)

        // Floating label
        const label = labelSprite(description.title, { sub: description.sub, scale: 0.85 })
        label.position.set(point.x, 3.2, point.z)
        this.game.scene.add(label)

        // Respawn and camera framing
        const spawn = builder.world(description.spawn.x, description.spawn.y, description.spawn.z)
        // Shift the focus right so the landmark sits left of the info panel
        const cinematicTarget = builder.world(6.5, 2, -4)
        // On phones the panel sits at the bottom, so push the landmark up instead
        const cinematicTargetPortrait = builder.world(0, 2, 3)

        return {
            name,
            key: description.key,
            title: description.title,
            builder,
            center,
            point,
            spawn,
            spawnRotation: FACE_CAMERA_Y + Math.PI / 2,
            cinematicTarget,
            cinematicTargetPortrait,
            ring,
            ringMaterial,
            disc,
            label,
            labelBaseScale: label.scale.clone(),
            proximity: 0,
            update: description.update ?? null
        }
    }

    getByKey(key)
    {
        return this.items.find((item) => item.key === key)
    }

    update(elapsed, delta, carPosition, env)
    {
        let closest = null
        let closestDistance = Infinity

        for(const area of this.items)
        {
            if(area.update)
                area.update(elapsed, delta, env)

            const distance = Math.hypot(carPosition.x - area.point.x, carPosition.z - area.point.z)
            const near = distance < INTERACT_RADIUS
            area.proximity += ((near ? 1 : 0) - area.proximity) * Math.min(1, delta * 8)

            const pulse = 1 + Math.sin(elapsed * 4) * 0.04
            const ringScale = (1 + area.proximity * 0.25) * pulse
            area.ring.scale.set(ringScale, 1, ringScale)
            area.ringMaterial.color.setRGB(1, 1 - area.proximity * 0.18, 1 - area.proximity * 0.75)
            area.label.position.y = 3.2 + Math.sin(elapsed * 1.5 + area.point.x) * 0.12 + area.proximity * 0.4
            area.label.scale.copy(area.labelBaseScale).multiplyScalar(1 + area.proximity * 0.15)

            if(near && distance < closestDistance)
            {
                closest = area
                closestDistance = distance
            }

            // Discovery
            const centerDistance = Math.hypot(carPosition.x - area.center.x, carPosition.z - area.center.z)
            if(centerDistance < DISCOVER_RADIUS && !this.discovered.has(area.key))
            {
                this.discovered.add(area.key)
                localStorage.setItem('discovered', JSON.stringify([ ...this.discovered ]))
                this.game.events.emit('discover', area, this.discovered.size, this.items.length)
            }
        }

        if(closest !== this.active)
        {
            this.active = closest
            this.game.events.emit('activeArea', closest)
        }
    }
}
