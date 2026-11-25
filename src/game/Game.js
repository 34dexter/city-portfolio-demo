import * as THREE from 'three'
import { FontLoader } from 'three/addons/loaders/FontLoader.js'
import { Physics } from './Physics.js'
import { Environment } from './Environment.js'
import { City } from './City.js'
import { Areas } from './Areas.js'
import { Vehicle } from './Vehicle.js'
import { CameraRig } from './CameraRig.js'
import { Controls, Emitter } from './Controls.js'
import { Audio } from './Audio.js'
import { Minimap } from './Minimap.js'
import { Weather } from './Weather.js'
import { StaticBatch } from './utils.js'
import { CITY_HALF } from './layout.js'

const IDLE_INPUT = { accelerating: 0, steering: 0, boosting: 0, braking: 1, jumping: false }

export class Game
{
    constructor(ui)
    {
        this.ui = ui
        this.events = new Emitter()
        this.state = 'loading'
        this.elapsed = 0
        this.lastSpeed = 0
        this.quality = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'low' : 'high'
    }

    async init()
    {
        const progress = (value, label) => this.ui.setProgress(value, label)

        // Renderer
        progress(0.05, 'Warming up the engine')
        this.canvas = document.querySelector('.webgl')
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' })
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality === 'high' ? 2 : 1.5))
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.shadowMap.enabled = true
        this.renderer.shadowMap.type = THREE.PCFShadowMap
        this.renderer.outputColorSpace = THREE.SRGBColorSpace

        this.scene = new THREE.Scene()
        this.batch = new StaticBatch()

        // Start downloading the physics engine right away, in parallel with fonts
        const physicsPromise = Physics.create()

        // Fonts used in canvas textures must be ready before drawing them
        progress(0.12, 'Loading fonts')
        await Promise.race([
            Promise.all([
                document.fonts.load('700 64px "Fredoka"'),
                document.fonts.load('600 32px "Nunito"'),
                document.fonts.load('700 32px "Nunito"'),
            ]),
            new Promise((resolve) => setTimeout(resolve, 3000))
        ]).catch(() => {})
        this.font = await new FontLoader().loadAsync(`${import.meta.env.BASE_URL}fonts/helvetiker_bold.typeface.json`)

        progress(0.3, 'Starting physics')
        this.physics = await physicsPromise

        progress(0.45, 'Building the city')
        await nextFrame()
        this.weather = new Weather(this) // before the city so ground materials can register for snow
        this.environment = new Environment(this)
        this.city = new City(this)

        progress(0.65, 'Opening the districts')
        await nextFrame()
        this.areas = new Areas(this)
        this.city.finalize()
        this.batch.build(this.scene)

        progress(0.85, 'Parking the car')
        await nextFrame()
        this.vehicle = new Vehicle(this)
        this.cameraRig = new CameraRig(this)
        this.controls = new Controls()
        this.audio = new Audio()
        this.minimap = new Minimap(this, document.querySelector('.minimap canvas'))

        this.spawnAt(this.areas.landing)
        this.setEvents()

        window.addEventListener('resize', () => this.resize())

        // Compile shaders before the first visible frame
        this.renderer.compile(this.scene, this.cameraRig.camera)
        this.timer = new THREE.Timer()
        this.timer.connect(document)
        this.renderer.setAnimationLoop(() => this.tick())

        this.state = 'intro'
        this.ui.bind(this)
        progress(1, 'Ready')
    }

    start()
    {
        if(this.state !== 'intro') return
        this.state = 'driving'
        this.controls.enabled = true
        this.audio.init()
        this.audio.resume()
        this.audio.chime()
    }

    setEvents()
    {
        const c = this.controls

        c.on('interact', () =>
        {
            if(this.state === 'intro') { this.ui.startFromKeyboard(); return }
            if(this.state === 'driving' && this.areas.active)
                this.openArea(this.areas.active)
        })
        c.on('escape', () =>
        {
            if(this.state === 'panel') this.closePanel()
            else if(this.ui.isPanelOpen()) this.ui.closePanel(true)
            else if(this.ui.isHelpOpen()) this.ui.toggleHelp(false)
            else if(this.state !== 'intro') this.ui.toggleMenu()
        })
        c.on('honk', () =>
        {
            if(this.state !== 'driving') return
            this.audio.honk()
            this.cameraRig.shake = Math.max(this.cameraRig.shake, 0.3)
        })
        c.on('respawn', () =>
        {
            if(this.state === 'driving') this.respawn()
        })
        c.on('toggleTime', () => this.toggleTime())
        c.on('weather', () => { if(this.state !== 'intro') this.cycleWeather() })
        c.on('toggleView', () => { if(this.state !== 'intro') this.toggleView() })
        c.on('mute', () => this.toggleMute())
        c.on('drive', () => { this.cameraRig.tracking = true })

        this.events.on('activeArea', (area) => this.ui.showPrompt(this.state === 'driving' ? area : null))
        this.events.on('discover', (area, count, total) =>
        {
            this.ui.setDiscovered(count, total)
            if(this.state !== 'intro')
            {
                this.ui.toast(`Discovered <strong>${area.title}</strong> · ${count}/${total}`)
                this.audio.chime()
            }
        })
        this.events.on('weather', (mode, manual) =>
        {
            this.ui.setWeatherIcon(mode, this.weather.auto)
            if(this.state === 'intro') return
            if(manual)
            {
                const labels = { clear: 'Clear skies', rain: 'Rain', snow: 'Snow' }
                this.ui.toast(this.weather.auto ? 'Weather: <strong>Auto</strong> (changes on its own)' : `Weather: <strong>${labels[mode]}</strong>`)
            }
            else
            {
                const messages = { clear: '🌤️ The sky is clearing up', rain: '🌧️ It\'s starting to rain', snow: '❄️ Snow is falling. Careful, the roads get slippery' }
                this.ui.toast(messages[mode])
            }
        })
        this.events.on('goal', () =>
        {
            this.ui.toast('⚽ <strong>GOAL!</strong> Nice shot.')
            this.audio.chime()
            this.cameraRig.shake = 1
        })

        this.ui.setDiscovered(this.areas.discovered.size, this.areas.items.length)
    }

    openArea(area)
    {
        this.state = 'panel'
        this.openedArea = area
        area.label.visible = false
        this.ui.showPrompt(null)
        const portrait = window.innerWidth <= 640
        this.cameraRig.startCinematic(portrait ? area.cinematicTargetPortrait : area.cinematicTarget)
        this.audio.blip(520, 0.12)
        this.ui.openPanel(area.key, () => this.closePanel(false))
    }

    closePanel(closeUi = true)
    {
        if(this.state !== 'panel') return
        this.state = 'driving'
        if(this.openedArea) this.openedArea.label.visible = true
        this.openedArea = null
        this.cameraRig.endCinematic()
        if(closeUi) this.ui.closePanel()
        this.audio.blip(440, 0.1)
        this.ui.showPrompt(this.areas.active)
    }

    // Menu / minimap navigation
    teleport(area, open = false)
    {
        if(this.state === 'panel') this.closePanel()
        this.ui.fade(() =>
        {
            this.spawnAt(area)
            if(this.state === 'intro') return
            this.state = 'driving'
            this.controls.enabled = true
            if(open)
                setTimeout(() => this.openArea(area), 350)
        })
    }

    spawnAt(area)
    {
        this.vehicle.moveTo(area.spawn, area.spawnRotation)
        this.cameraRig.tracking = true
        this.cameraRig.snapTo(area.spawn)
    }

    respawn(withFade = true)
    {
        // Closest district spawn point
        let best = this.areas.landing
        let bestDistance = Infinity
        for(const area of this.areas.items)
        {
            const d = area.spawn.distanceTo(this.vehicle.position)
            if(d < bestDistance) { best = area; bestDistance = d }
        }
        if(withFade) this.ui.fade(() => this.spawnAt(best))
        else this.spawnAt(best)
    }

    resetWorld()
    {
        this.physics.resetAll()
        this.ui.toast('Everything is back in place')
    }

    toggleView()
    {
        const mode = this.cameraRig.toggleMode()
        this.ui.setViewIcon(mode)
        if(mode === 'firstPerson')
            this.ui.toast('First-person view · press <strong>C</strong> to switch back')
    }

    cycleWeather()
    {
        const { mode, auto } = this.weather.cycle()
        this.ui.setWeatherIcon(mode, auto)
    }

    toggleTime()
    {
        const goingToNight = !this.environment.isNight
        this.environment.toggle()
        this.ui.setTimeIcon(!goingToNight)
    }

    toggleMute()
    {
        this.audio.init()
        const muted = this.audio.toggleMute()
        this.ui.setMuteIcon(muted)
    }

    resize()
    {
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.cameraRig.resize()
        this.weather.resize()
    }

    tick()
    {
        this.timer.update()
        const delta = Math.min(this.timer.getDelta(), 1 / 30)
        this.elapsed += delta
        const deltaScaled = delta * 2

        this.controls.update()
        const input = this.state === 'driving' ? this.controls.state : IDLE_INPUT

        this.vehicle.prePhysics(input, deltaScaled, delta)
        this.physics.step(deltaScaled)
        this.vehicle.postPhysics(deltaScaled, delta, this.elapsed)

        // Impacts
        const speedDrop = this.lastSpeed - this.vehicle.speed
        if(speedDrop > 5 && this.state === 'driving')
        {
            this.audio.thud(speedDrop / 15)
            this.cameraRig.shake = Math.min(1.5, speedDrop / 8)
        }
        this.lastSpeed = this.vehicle.speed

        // Fell in the water or left the island
        const p = this.vehicle.position
        if(p.y < -3 || Math.abs(p.x) > CITY_HALF + 20 || Math.abs(p.z) > CITY_HALF + 20)
        {
            if(!this.respawning)
            {
                this.respawning = true
                this.ui.toast('Splash! Back to dry land.')
                this.ui.fade(() =>
                {
                    this.respawn(false)
                    this.respawning = false
                })
            }
        }

        this.weather.update(delta, this.elapsed, this.cameraRig.smoothedFocus, this.environment.current.night)
        this.vehicle.grip = this.weather.grip
        this.environment.update(delta, this.cameraRig.smoothedFocus)
        const night = this.environment.current.night
        const isNight = night > 0.5
        if(isNight !== this.wasNight && this.environment.target === null)
        {
            this.wasNight = isNight
            this.ui.setTimeIcon(!isNight)
        }
        this.city.update(night)
        this.vehicle.setNight(night)

        this.areas.update(this.elapsed, delta, this.vehicle.position, this.environment)
        this.cameraRig.update(delta, this.vehicle)
        this.audio.update(input, this.vehicle.xzSpeed ?? 0, this.vehicle.wheelsInContact, this.weather)
        this.minimap.update()

        this.renderer.render(this.scene, this.cameraRig.camera)
    }
}

function nextFrame()
{
    return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
