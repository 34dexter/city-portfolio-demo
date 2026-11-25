import * as THREE from 'three'
import { lerp, createRandom } from './utils.js'

const MODES = [ 'clear', 'rain', 'snow' ]
const AREA_SIZE = 70 // precipitation box around the player
const AREA_HEIGHT = 32

/**
 * Weather: clear, rain or snow.
 * - Changes on its own every few minutes (auto), or can be picked from the HUD (T key).
 * - Rain and snow are GPU-animated particles that wrap around the player, so the CPU only updates uniforms.
 * - Bad weather darkens the sky and thickens the fog (see Environment), rain brings lightning,
 *   snow slowly covers the ground and both reduce tyre grip.
 */
export class Weather
{
    constructor(game)
    {
        this.game = game
        this.random = createRandom(77)

        this.mode = 'clear'
        this.auto = true
        this.nextChange = 150 + Math.random() * 90

        // Smoothed intensities 0..1
        this.rain = 0
        this.snow = 0
        this.snowCover = 0
        this.flash = 0
        this.nextLightning = 6

        this.groundMaterials = []
        this.snowWhite = new THREE.Color('#f3f6fb')

        const low = game.quality === 'low'
        this.setRain(low ? 1400 : 3200)
        this.setSnow(low ? 1500 : 3500)
    }

    get overcast()
    {
        return Math.max(this.rain, this.snow * 0.75)
    }

    // Ground materials whose color should turn white under snow
    registerGround(material, strength = 0.85)
    {
        this.groundMaterials.push({ material, base: material.color.clone(), strength })
    }

    set(mode, { manual = true } = {})
    {
        if(!MODES.includes(mode)) return
        this.mode = mode
        if(manual) this.auto = false
        this.game.events.emit('weather', mode, manual)
    }

    // HUD button: Auto → Clear → Rain → Snow → Auto
    cycle()
    {
        if(this.auto)
        {
            this.set('clear')
        }
        else if(this.mode === 'snow')
        {
            this.auto = true
            this.nextChange = 60
            this.game.events.emit('weather', this.mode, true)
        }
        else
        {
            this.set(MODES[MODES.indexOf(this.mode) + 1])
        }
        return { mode: this.mode, auto: this.auto }
    }

    pickRandom()
    {
        const r = this.random()
        if(this.mode !== 'clear')
            return r < 0.75 ? 'clear' : (this.mode === 'rain' ? 'snow' : 'rain')
        return r < 0.7 ? 'rain' : 'snow'
    }

    createMaterial(vertexShader, fragmentShader, uniforms)
    {
        return new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uCenter: { value: new THREE.Vector3() },
                uSize: { value: AREA_SIZE },
                uHeight: { value: AREA_HEIGHT },
                uOpacity: { value: 0 },
                uColor: { value: new THREE.Color('#ffffff') },
                ...uniforms
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
        })
    }

    setRain(count)
    {
        const positions = new Float32Array(count * 2 * 3)
        const ends = new Float32Array(count * 2)
        for(let i = 0; i < count; i++)
        {
            const x = (this.random() - 0.5) * AREA_SIZE
            const y = this.random() * AREA_HEIGHT
            const z = (this.random() - 0.5) * AREA_SIZE
            for(let v = 0; v < 2; v++)
            {
                positions.set([ x, y, z ], (i * 2 + v) * 3)
                ends[i * 2 + v] = v
            }
        }
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1))

        const material = this.createMaterial(
            /* glsl */`
                uniform float uTime;
                uniform vec3 uCenter;
                uniform float uSize;
                uniform float uHeight;
                uniform vec2 uWind;
                attribute float aEnd;
                varying float vEnd;

                void main()
                {
                    vec3 p = position;
                    p.y = mod(p.y - uTime * 26.0, uHeight);
                    p.xz += uWind * (uHeight - p.y) * 0.12;
                    p.x = mod(p.x - uCenter.x + uSize * 0.5, uSize) - uSize * 0.5 + uCenter.x;
                    p.z = mod(p.z - uCenter.z + uSize * 0.5, uSize) - uSize * 0.5 + uCenter.z;

                    // Streak toward the fall direction
                    p += aEnd * normalize(vec3(uWind.x * 0.12, -1.0, uWind.y * 0.12)) * 1.2;
                    vEnd = aEnd;
                    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
                }
            `,
            /* glsl */`
                uniform vec3 uColor;
                uniform float uOpacity;
                varying float vEnd;

                void main()
                {
                    gl_FragColor = vec4(uColor, uOpacity * (0.25 + vEnd * 0.75));
                }
            `,
            { uWind: { value: new THREE.Vector2(0.6, 0.3) } }
        )
        material.uniforms.uColor.value.set('#eef4ff')

        this.rainMesh = new THREE.LineSegments(geometry, material)
        this.rainMesh.frustumCulled = false
        this.rainMesh.visible = false
        this.rainMesh.renderOrder = 6
        this.game.scene.add(this.rainMesh)
    }

    setSnow(count)
    {
        const positions = new Float32Array(count * 3)
        const seeds = new Float32Array(count)
        for(let i = 0; i < count; i++)
        {
            positions.set([ (this.random() - 0.5) * AREA_SIZE, this.random() * AREA_HEIGHT, (this.random() - 0.5) * AREA_SIZE ], i * 3)
            seeds[i] = this.random()
        }
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))

        const material = this.createMaterial(
            /* glsl */`
                uniform float uTime;
                uniform vec3 uCenter;
                uniform float uSize;
                uniform float uHeight;
                uniform float uViewportHeight;
                attribute float aSeed;

                void main()
                {
                    vec3 p = position;
                    float speed = 2.2 + aSeed * 1.6;
                    p.y = mod(p.y - uTime * speed, uHeight);
                    p.x += sin(uTime * 0.7 + aSeed * 6.28) * 0.8;
                    p.z += cos(uTime * 0.5 + aSeed * 12.0) * 0.8;
                    p.x = mod(p.x - uCenter.x + uSize * 0.5, uSize) - uSize * 0.5 + uCenter.x;
                    p.z = mod(p.z - uCenter.z + uSize * 0.5, uSize) - uSize * 0.5 + uCenter.z;

                    vec4 mvPosition = viewMatrix * vec4(p, 1.0);
                    gl_Position = projectionMatrix * mvPosition;

                    // Size in world units converted to pixels, works for any lens
                    float worldSize = 0.14 + aSeed * 0.12;
                    gl_PointSize = clamp(worldSize * projectionMatrix[1][1] * uViewportHeight * 0.5 / -mvPosition.z, 1.0, 36.0);
                }
            `,
            /* glsl */`
                uniform vec3 uColor;
                uniform float uOpacity;

                void main()
                {
                    float d = length(gl_PointCoord - 0.5);
                    if(d > 0.5) discard;
                    gl_FragColor = vec4(uColor, uOpacity * smoothstep(0.5, 0.15, d));
                }
            `,
            { uViewportHeight: { value: window.innerHeight * this.game.renderer.getPixelRatio() } }
        )

        this.snowMesh = new THREE.Points(geometry, material)
        this.snowMesh.frustumCulled = false
        this.snowMesh.visible = false
        this.snowMesh.renderOrder = 6
        this.game.scene.add(this.snowMesh)
    }

    resize()
    {
        this.snowMesh.material.uniforms.uViewportHeight.value = window.innerHeight * this.game.renderer.getPixelRatio()
    }

    update(delta, elapsed, center, night)
    {
        // Automatic changes
        if(this.auto)
        {
            this.nextChange -= delta
            if(this.nextChange <= 0)
            {
                this.nextChange = 120 + this.random() * 120
                this.set(this.pickRandom(), { manual: false })
            }
        }

        // Ease intensities toward the target weather
        const ease = Math.min(1, delta * 0.35)
        this.rain = lerp(this.rain, this.mode === 'rain' ? 1 : 0, ease)
        this.snow = lerp(this.snow, this.mode === 'snow' ? 1 : 0, ease)
        if(this.rain < 0.002) this.rain = 0
        if(this.snow < 0.002) this.snow = 0

        // Snow builds up slowly and melts a bit faster
        const coverTarget = this.snow > 0.5 ? 1 : 0
        this.snowCover = lerp(this.snowCover, coverTarget, Math.min(1, delta * (coverTarget ? 0.12 : 0.2)))
        for(const item of this.groundMaterials)
            item.material.color.copy(item.base).lerp(this.snowWhite, this.snowCover * item.strength)

        // Particles
        for(const mesh of [ this.rainMesh, this.snowMesh ])
        {
            mesh.material.uniforms.uTime.value = elapsed
            mesh.material.uniforms.uCenter.value.copy(center)
        }
        this.rainMesh.visible = this.rain > 0.01
        this.rainMesh.material.uniforms.uOpacity.value = this.rain * (0.8 - night * 0.25)
        this.snowMesh.visible = this.snow > 0.01
        this.snowMesh.material.uniforms.uOpacity.value = this.snow * (0.95 - night * 0.25)

        // Lightning during heavy rain
        this.flash = Math.max(0, this.flash - delta * 4)
        if(this.rain > 0.7)
        {
            this.nextLightning -= delta
            if(this.nextLightning <= 0)
            {
                this.nextLightning = 7 + this.random() * 14
                this.flash = 1
                setTimeout(() => { this.flash = Math.max(this.flash, 0.6) }, 120)
                this.game.audio.thunder(400 + this.random() * 1200)
            }
        }
    }

    // Tyre grip multiplier for the car
    get grip()
    {
        return 1 - this.rain * 0.2 - this.snowCover * 0.5
    }
}
