import { ROADS, ROAD_HALF_WIDTH, CITY_HALF } from './layout.js'

const AREA_COLORS = {
    about: '#ffd23f',
    skills: '#b77dff',
    internship: '#4fd1e8',
    hudl: '#ff6a13',
    education: '#c0485a',
    eventPlanner: '#ff7ab8',
    boneCancer: '#4fb3ff',
    solarTracker: '#ffb02e',
    contact: '#ff5a4e',
}

/**
 * Minimap rotated to match the camera: screen-up on the map equals screen-up in the 3D view.
 */
export class Minimap
{
    constructor(game, element)
    {
        this.game = game
        this.canvas = element
        this.ctx = element.getContext('2d')
        this.size = 0
        this.resize()
        window.addEventListener('resize', () => this.resize())

        element.addEventListener('click', (event) =>
        {
            const rect = element.getBoundingClientRect()
            const px = (event.clientX - rect.left) * this.pixelRatio
            const py = (event.clientY - rect.top) * this.pixelRatio
            let best = null
            for(const area of this.game.areas.items)
            {
                const [ u, v ] = this.toMap(area.center.x, area.center.z)
                const distance = Math.hypot(u - px, v - py)
                if(distance < 26 * this.pixelRatio && (!best || distance < best.distance))
                    best = { area, distance }
            }
            if(best)
                this.game.teleport(best.area)
        })
    }

    resize()
    {
        this.pixelRatio = Math.min(window.devicePixelRatio, 2)
        const cssSize = this.canvas.clientWidth || 180
        this.size = Math.round(cssSize * this.pixelRatio)
        this.canvas.width = this.canvas.height = this.size
        this.scale = this.size / (CITY_HALF * 2 * Math.SQRT2 + 16)
        this.base = null
    }

    toMap(x, z)
    {
        const u = (x - z) / Math.SQRT2
        const v = (x + z) / Math.SQRT2
        return [ this.size / 2 + u * this.scale, this.size / 2 + v * this.scale ]
    }

    drawBase()
    {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = this.size
        const ctx = canvas.getContext('2d')

        const polygon = (points, color) =>
        {
            ctx.fillStyle = color
            ctx.beginPath()
            points.forEach(([ x, z ], i) =>
            {
                const [ u, v ] = this.toMap(x, z)
                if(i === 0) ctx.moveTo(u, v)
                else ctx.lineTo(u, v)
            })
            ctx.closePath()
            ctx.fill()
        }
        const rect = (x0, z0, x1, z1, color) => polygon([ [ x0, z0 ], [ x1, z0 ], [ x1, z1 ], [ x0, z1 ] ], color)

        rect(-CITY_HALF, -CITY_HALF, CITY_HALF, CITY_HALF, 'rgba(159,208,122,0.95)')
        for(const r of ROADS)
        {
            rect(r - ROAD_HALF_WIDTH, -CITY_HALF, r + ROAD_HALF_WIDTH, CITY_HALF, 'rgba(74,74,92,0.95)')
            rect(-CITY_HALF, r - ROAD_HALF_WIDTH, CITY_HALF, r + ROAD_HALF_WIDTH, 'rgba(74,74,92,0.95)')
        }

        for(const area of this.game.areas.items)
        {
            const { x, z } = area.center
            rect(x - 18, z - 18, x + 18, z + 18, AREA_COLORS[area.key] ?? '#ffffff')
        }
        this.base = canvas
    }

    update()
    {
        if(!this.base)
            this.drawBase()

        const ctx = this.ctx
        ctx.clearRect(0, 0, this.size, this.size)
        ctx.drawImage(this.base, 0, 0)

        // Discovered markers
        ctx.font = `700 ${11 * this.pixelRatio}px Nunito, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for(const area of this.game.areas.items)
        {
            const [ u, v ] = this.toMap(area.center.x, area.center.z)
            const discovered = this.game.areas.discovered.has(area.key)
            ctx.fillStyle = discovered ? '#1d1b2f' : 'rgba(29,27,47,0.45)'
            ctx.fillText(discovered ? '✓' : '?', u, v)
        }

        // Car arrow
        const vehicle = this.game.vehicle
        const [ u, v ] = this.toMap(vehicle.position.x, vehicle.position.z)
        const fx = vehicle.forward.x
        const fz = vehicle.forward.z
        const angle = Math.atan2((fx + fz) / Math.SQRT2, (fx - fz) / Math.SQRT2)
        ctx.save()
        ctx.translate(u, v)
        ctx.rotate(angle)
        const s = 7 * this.pixelRatio
        ctx.fillStyle = '#ff3b30'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2 * this.pixelRatio
        ctx.beginPath()
        ctx.moveTo(s, 0)
        ctx.lineTo(-s * 0.7, s * 0.65)
        ctx.lineTo(-s * 0.3, 0)
        ctx.lineTo(-s * 0.7, -s * 0.65)
        ctx.closePath()
        ctx.stroke()
        ctx.fill()
        ctx.restore()
    }
}
