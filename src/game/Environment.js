import * as THREE from 'three'
import { smoothstep } from './utils.js'

const preset = (sky, sun, sunIntensity, hemiSky, hemiGround, hemiIntensity, night) => ({
    sky: new THREE.Color(sky),
    sun: new THREE.Color(sun),
    sunIntensity,
    hemiSky: new THREE.Color(hemiSky),
    hemiGround: new THREE.Color(hemiGround),
    hemiIntensity,
    night
})

const PRESETS = {
    day: preset('#a8dcff', '#fff0d9', 2.6, '#d9f0ff', '#8a9a62', 1.5, 0),
    dusk: preset('#ff9f8f', '#ff9a6a', 1.6, '#ffc0a8', '#5a4466', 1.2, 0.55),
    night: preset('#1a2150', '#8d9bff', 0.55, '#4656a8', '#1d1838', 0.9, 1),
    dawn: preset('#ffc9b0', '#ffc28c', 1.7, '#ffe0cc', '#6a5470', 1.2, 0.35),
}

const OVERCAST_DAY = new THREE.Color('#9aa6b4')
const OVERCAST_NIGHT = new THREE.Color('#151a2c')
const FLASH_COLOR = new THREE.Color('#e8ecff')

// Keyframes over one cycle (0 → 1)
const KEYFRAMES = [
    [ 0.0, PRESETS.day ],
    [ 0.42, PRESETS.day ],
    [ 0.52, PRESETS.dusk ],
    [ 0.6, PRESETS.night ],
    [ 0.86, PRESETS.night ],
    [ 0.94, PRESETS.dawn ],
    [ 1.0, PRESETS.day ],
]

export class Environment
{
    constructor(game)
    {
        this.game = game
        this.scene = game.scene

        this.duration = 6 * 60 // seconds per day
        this.progress = 0.08
        this.timeScale = 1
        this.target = null

        this.current = {
            sky: new THREE.Color(), sun: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(),
            sunIntensity: 1, hemiIntensity: 1, night: 0
        }

        this.scene.background = new THREE.Color()
        this.scene.fog = new THREE.Fog('#a8dcff', 70, 190)

        this.hemi = new THREE.HemisphereLight('#ffffff', '#888888', 1)
        this.scene.add(this.hemi)

        this.sun = new THREE.DirectionalLight('#ffffff', 2)
        this.sun.castShadow = true
        const size = 38
        this.sun.shadow.camera.left = -size
        this.sun.shadow.camera.right = size
        this.sun.shadow.camera.top = size
        this.sun.shadow.camera.bottom = -size
        this.sun.shadow.camera.near = 1
        this.sun.shadow.camera.far = 160
        this.sun.shadow.mapSize.set(game.quality === 'high' ? 2048 : 1024, game.quality === 'high' ? 2048 : 1024)
        this.sun.shadow.bias = -0.0006
        this.sun.shadow.normalBias = 0.04
        this.scene.add(this.sun, this.sun.target)

        this.sunDirection = new THREE.Vector3(0.5, 0.8, 0.3).normalize()
        this.overcastSky = new THREE.Color()
        this.update(0, new THREE.Vector3())
    }

    toggle()
    {
        // Jump between day and night with a quick transition
        const isNight = this.current.night > 0.5
        this.target = isNight ? 0.02 : 0.66
    }

    get isNight()
    {
        return this.current.night > 0.5
    }

    sample()
    {
        const p = this.progress
        for(let i = 0; i < KEYFRAMES.length - 1; i++)
        {
            const [ stopA, a ] = KEYFRAMES[i]
            const [ stopB, b ] = KEYFRAMES[i + 1]
            if(p >= stopA && p <= stopB)
            {
                const t = smoothstep(p, stopA, stopB)
                const c = this.current
                c.sky.lerpColors(a.sky, b.sky, t)
                c.sun.lerpColors(a.sun, b.sun, t)
                c.hemiSky.lerpColors(a.hemiSky, b.hemiSky, t)
                c.hemiGround.lerpColors(a.hemiGround, b.hemiGround, t)
                c.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t
                c.hemiIntensity = a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t
                c.night = a.night + (b.night - a.night) * t
                return
            }
        }
    }

    update(delta, focus)
    {
        // Advance time (fast-forward when a toggle target is set)
        if(this.target !== null)
        {
            let diff = this.target - this.progress
            if(diff < 0) diff += 1
            const step = Math.min(diff, delta * 0.35)
            this.progress = (this.progress + step) % 1
            if(diff - step < 0.001)
                this.target = null
        }
        else
        {
            this.progress = (this.progress + delta / this.duration) % 1
        }

        this.sample()
        const c = this.current

        // Weather: clouds dim the sun, grey the sky and pull the fog closer; lightning flashes the sky
        const weather = this.game.weather
        const overcast = weather ? weather.overcast : 0
        const flash = weather ? weather.flash : 0
        this.overcastSky.lerpColors(OVERCAST_DAY, OVERCAST_NIGHT, c.night)

        this.scene.background.copy(c.sky).lerp(this.overcastSky, overcast * 0.8).lerp(FLASH_COLOR, flash * 0.55)
        this.scene.fog.color.copy(this.scene.background)
        this.scene.fog.near = 70 - overcast * 38
        this.scene.fog.far = 190 - overcast * 85
        this.hemi.color.copy(c.hemiSky)
        this.hemi.groundColor.copy(c.hemiGround)
        this.hemi.intensity = c.hemiIntensity * (1 - overcast * 0.2) + flash * 2.5
        this.sun.color.copy(c.sun)
        this.sun.intensity = c.sunIntensity * (1 - overcast * 0.7)

        // Sun path: sweeps across the sky; the moon takes over at night from the other side
        const angle = this.progress * Math.PI * 2
        const azimuth = 0.9 + Math.sin(angle) * 1.1
        const elevation = 0.95 - Math.abs(Math.sin(angle * 0.5)) * 0.35
        this.sunDirection.set(
            Math.cos(azimuth) * Math.cos(elevation),
            Math.sin(elevation),
            Math.sin(azimuth) * Math.cos(elevation)
        ).normalize()

        this.sun.position.copy(focus).addScaledVector(this.sunDirection, 70)
        this.sun.target.position.copy(focus)
    }
}
