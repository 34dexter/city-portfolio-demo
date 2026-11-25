import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
export const remapClamp = (v, inMin, inMax, outMin, outMax) => outMin + clamp((v - inMin) / (inMax - inMin), 0, 1) * (outMax - outMin)
export const smoothstep = (v, min, max) =>
{
    const t = clamp((v - min) / (max - min), 0, 1)
    return t * t * (3 - 2 * t)
}

// Seeded random so the city looks the same on every visit
export function createRandom(seed = 1)
{
    let s = seed >>> 0
    return () =>
    {
        s += 0x6d2b79f5
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

/**
 * Materials cache: one Lambert material per color keeps draw calls mergeable.
 */
const materialCache = new Map()
export function mat(color, options = {})
{
    const key = color + JSON.stringify(options)
    if(!materialCache.has(key))
        materialCache.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...options }))
    return materialCache.get(key)
}

/**
 * Static batcher: collects static geometry and merges it per material at the end.
 * This turns hundreds of small meshes into a handful of draw calls.
 */
export class StaticBatch
{
    constructor()
    {
        this.groups = new Map()
    }

    add(geometry, material, matrix)
    {
        let g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
        g.applyMatrix4(matrix)
        for(const name of Object.keys(g.attributes))
        {
            if(name !== 'position' && name !== 'normal' && name !== 'uv')
                g.deleteAttribute(name)
        }
        if(!g.attributes.uv)
            g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))

        if(!this.groups.has(material))
            this.groups.set(material, [])
        this.groups.get(material).push(g)
    }

    addMesh(mesh)
    {
        mesh.updateMatrixWorld(true)
        this.add(mesh.geometry, mesh.material, mesh.matrixWorld)
    }

    build(scene, { castShadow = true, receiveShadow = true } = {})
    {
        const meshes = []
        this.groups.forEach((geometries, material) =>
        {
            const merged = mergeGeometries(geometries, false)
            for(const g of geometries) g.dispose()
            const mesh = new THREE.Mesh(merged, material)
            mesh.castShadow = castShadow
            mesh.receiveShadow = receiveShadow
            mesh.matrixAutoUpdate = false
            scene.add(mesh)
            meshes.push(mesh)
        })
        this.groups.clear()
        return meshes
    }
}

/**
 * Canvas text texture
 */
export const FONT_DISPLAY = '"Fredoka", "Trebuchet MS", sans-serif'
export const FONT_BODY = '"Nunito", "Segoe UI", sans-serif'

export function textTexture(lines, {
    width = 512,
    height = 256,
    background = '#ffffff',
    color = '#1d1b2f',
    font = FONT_DISPLAY,
    weight = 700,
    sizes = null,
    radius = 24,
    border = null,
    padding = 0
} = {})
{
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if(background)
    {
        ctx.fillStyle = background
        roundRect(ctx, padding, padding, width - padding * 2, height - padding * 2, radius)
        ctx.fill()
    }
    if(border)
    {
        ctx.strokeStyle = border
        ctx.lineWidth = 10
        roundRect(ctx, padding + 5, padding + 5, width - padding * 2 - 10, height - padding * 2 - 10, radius)
        ctx.stroke()
    }

    const textLines = Array.isArray(lines) ? lines : [ lines ]
    const lineSizes = sizes ?? textLines.map((_, i) => (i === 0 ? height * 0.36 : height * 0.18))
    const total = lineSizes.reduce((sum, size) => sum + size * 1.15, 0)
    let y = (height - total) / 2

    ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    textLines.forEach((line, i) =>
    {
        let size = lineSizes[i]
        ctx.font = `${i === 0 ? weight : 600} ${size}px ${font}`
        // Shrink to fit
        while(ctx.measureText(line).width > width * 0.9 && size > 8)
        {
            size -= 2
            ctx.font = `${i === 0 ? weight : 600} ${size}px ${font}`
        }
        ctx.fillText(line, width / 2, y + (lineSizes[i] - size) / 2)
        y += lineSizes[i] * 1.15
    })

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    return texture
}

export function roundRect(ctx, x, y, w, h, r)
{
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

export function radialGlowTexture(inner = 'rgba(255,220,150,1)', outer = 'rgba(255,200,120,0)')
{
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, inner)
    gradient.addColorStop(1, outer)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

/**
 * Billboard label (sprite) used above interaction points and landmarks
 */
export function labelSprite(text, { color = '#ffffff', background = 'rgba(29,27,47,0.92)', scale = 1, sub = null } = {})
{
    const lines = sub ? [ text, sub ] : [ text ]
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const mainSize = 64
    const subSize = 34
    ctx.font = `700 ${mainSize}px ${FONT_DISPLAY}`
    let w = ctx.measureText(text).width
    if(sub)
    {
        ctx.font = `600 ${subSize}px ${FONT_BODY}`
        w = Math.max(w, ctx.measureText(sub).width)
    }
    canvas.width = Math.ceil(w + 80)
    canvas.height = sub ? 150 : 104
    ctx.fillStyle = background
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 34)
    ctx.fill()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = color
    ctx.font = `700 ${mainSize}px ${FONT_DISPLAY}`
    ctx.fillText(lines[0], canvas.width / 2, sub ? 54 : canvas.height / 2 + 2)
    if(sub)
    {
        ctx.globalAlpha = 0.75
        ctx.font = `600 ${subSize}px ${FONT_BODY}`
        ctx.fillText(sub, canvas.width / 2, 112)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: true, transparent: true })
    const sprite = new THREE.Sprite(material)
    const worldHeight = (sub ? 1.9 : 1.3) * scale
    sprite.scale.set(worldHeight * canvas.width / canvas.height, worldHeight, 1)
    sprite.renderOrder = 5
    return sprite
}
